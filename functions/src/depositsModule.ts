import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as WalletManager from './walletManager';
import * as AppModule from './appModule';
import { ServiceError } from './serviceError';
import { createCallback } from './webhookModule';
import { Transaction } from 'turtlecoin-wallet-backend/dist/lib/Types';
import { ServiceWallet } from './types';
import { AppUser, AppUserUpdate, TurtleApp, SubWalletInfo,
  Deposit, DepositStatus, AppDepositUpdate } from '../../shared/types';

export async function getDeposit(
  appId: string,
  depositId: string): Promise<[Deposit | undefined, undefined | ServiceError]> {

  const depositDoc = await admin.firestore().doc(`apps/${appId}/deposits/${depositId}`).get();

  if (depositDoc.exists) {
    const depositRequest = depositDoc.data() as Deposit;
    return [depositRequest, undefined];
  } else {
    return [undefined, new ServiceError('app/deposit-not-found')];
  }
}

export async function updateDeposits(): Promise<void> {
  const [serviceWallet, error] = await WalletManager.getServiceWallet();
  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError).message}`);
    return;
  }

  const [walletHeight, ,] = serviceWallet.wallet.getSyncStatus();
  const scanHeight        = Math.max(0, walletHeight - serviceWallet.serviceConfig.txScanDepth);

  const transactions = serviceWallet.wallet
    .getTransactions(undefined, undefined, false)
    .filter(tx => {
      const transfers = Array.from(tx.transfers.values());

      // tx must be above scan height and contain at least one positive amount transfer
      return tx.blockHeight >= scanHeight && transfers.find(t => t > 0);
    });

  const deposits = await getAllDeposits(scanHeight);

  await scanNewDeposits(transactions, deposits);
  await updateConfirmingDeposits(serviceWallet);
}

export async function processUserDepositUpdate(
  oldState: Deposit,
  newState: Deposit): Promise<void> {

  const [app, error] = await AppModule.getApp(oldState.appId);

  if (!app) {
    console.error((error as ServiceError).message);
    return;
  }

  if (oldState.status === 'confirming' && newState.status === 'completed') {
    if (newState.cancelled) {
      await createCallback(app, 'deposit/cancelled', newState);
    } else {
      await createCallback(app, 'deposit/succeeded', newState);
    }
  }
}

export async function getAllDepositsWithStatus(status: DepositStatus): Promise<Deposit[]> {
  const depositDocs = await admin.firestore()
                        .collectionGroup('deposits')
                        .where('status', '==', status)
                        .get();

  return depositDocs.docs.map(d => d.data() as Deposit);
}

export async function getAllDeposits(fromHeight: number): Promise<Deposit[]> {
  const depositDocs = await admin.firestore()
                        .collectionGroup('deposits')
                        .where('blockHeight', '>=', fromHeight)
                        .get();

  return depositDocs.docs.map(d => d.data() as Deposit);
}

async function scanNewDeposits(transactions: Transaction[], deposits: Deposit[]): Promise<void> {
  if (transactions.length === 0 && deposits.length === 0) {
    console.log('no new transactions to scan.');
    return;
  }

  const newTxs: Transaction[] = [];

  transactions.forEach(tx => {
    const match = deposits.find(d => d.txHash === tx.hash);

    if (!match && tx.paymentID !== '') {
      newTxs.push(tx)
    };
  });

  console.log(`new deposit tx count: ${newTxs.length}`);

  if (newTxs.length === 0) {
    return;
  }

  const processDepositsPromises       = newTxs.map(tx => processDepositTransaction(tx));
  const processedDeposits             = await Promise.all(processDepositsPromises);
  const newDepositObjects: Deposit[]  = [];

  processedDeposits.forEach(deposit => {
    if (deposit) {
      newDepositObjects.push(deposit);
    }
  });

  if (newDepositObjects.length === 0) {
    return;
  }

  console.log(`creating new deposits: ${newDepositObjects.length}`);

  await Promise.all(newDepositObjects.map(d => createNewDeposit(d)));
}

async function processDepositTransaction(tx: Transaction): Promise<Deposit | undefined> {
  const app = await findAppForDepositTx(tx);

  if (!app) {
    // console.log(`failed to find app for tx with paymentID: ${tx.paymentID}, hash: ${tx.hash}`);
    return undefined;
  }

  const user = await findUserForDepositTx(tx, app);

  if (!user) {
    // console.log(`failed to find user for tx with paymentID: ${tx.paymentID}, hash: ${tx.hash}`);
    return undefined;
  }

  const depositId = createDepositId(tx.paymentID, tx.hash);
  let totalAmount = 0;

  tx.transfers.forEach((amount, publicKey) => {
    if (publicKey === app.publicKey) {
      totalAmount += amount;
    }
  });

  const deposit = createDepositObject(
    depositId,
    app.appId,
    tx.paymentID,
    app.subWallet,
    user.depositAddress,
    user.userId,
    totalAmount,
    tx.hash,
    tx.blockHeight);

  return deposit;
}

async function createNewDeposit(deposit: Deposit): Promise<void> {
  let creationSucceeded = false;

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const userDocRef    = admin.firestore().doc(`apps/${deposit.appId}/users/${deposit.userId}`);
      const depositDocRef = admin.firestore().doc(`apps/${deposit.appId}/deposits/${deposit.id}`);

      const userDoc           = await txn.get(userDocRef);
      const user              = userDoc.data() as AppUser;
      const newLockedBalance  = user.balanceLocked + deposit.amount;

      const userUpdate: AppUserUpdate = {
        balanceLocked: newLockedBalance
      }

      txn.create(depositDocRef, deposit);
      txn.update(userDocRef, userUpdate);

      creationSucceeded = true;
    });
  } catch (error) {
    console.error(error);
  }

  if (creationSucceeded) {
    const [app, error] = await AppModule.getApp(deposit.appId);

    if (error) {
      console.error(error.message);
    }

    if (app) {
      await createCallback(app, 'deposit/confirming', deposit);
    }
  }
}

function createDepositId(paymentId: string, txHash: string): string {
  const hash = crypto.createHash('md5');

  hash.update(paymentId);
  hash.update(txHash);

  return hash.digest('hex');
}

async function findAppForDepositTx(transaction: Transaction): Promise<TurtleApp | undefined> {
  for (const [publickKey, ] of transaction.transfers) {
    // console.log(`tx paymentID: ${transaction.paymentID}, public key: ${publickKey}, amount: ${amount}`);

    const querySnapshot = await admin.firestore()
                          .collection('wallets/master/subWallets')
                          .where('publicSpendKey', '==', publickKey)
                          .get();

    if (querySnapshot.size === 0) {
      continue;
    }

    const subWalletInfo = querySnapshot.docs[0].data() as SubWalletInfo;

    if (!subWalletInfo.appId) {
      return undefined;
    }

    const appSnapshot = await admin.firestore().doc(`apps/${subWalletInfo.appId}`).get();

    if (!appSnapshot.exists) {
      return undefined;
    }

    return appSnapshot.data() as TurtleApp;
  }

  return undefined;
}

async function findUserForDepositTx(transaction: Transaction, app: TurtleApp): Promise<AppUser | undefined> {
  const querySnapshot = await admin.firestore()
                        .collection(`apps/${app.appId}/users`)
                        .where('paymentId', '==', transaction.paymentID)
                        .get();

  if (querySnapshot.size === 1) {
    return querySnapshot.docs[0].data() as AppUser;
  }

  return undefined;
}

async function updateConfirmingDeposits(serviceWallet: ServiceWallet): Promise<void> {
  const wallet              = serviceWallet.wallet;
  const serviceConfig       = serviceWallet.serviceConfig;
  const [walletHeight,,]    = wallet.getSyncStatus();
  const confirmingDeposits  = await getAllDepositsWithStatus('confirming');

  const cancelledDeposits:  Deposit[] = [];
  const successfulDeposits: Deposit[] = [];

  for (const deposit of confirmingDeposits) {
    let depositTx: Transaction | undefined = undefined;

    if (deposit.txHash) {
      depositTx = serviceWallet.wallet.getTransaction(deposit.txHash);
    }

    if (!depositTx) {
      if (walletHeight > deposit.blockHeight + 120) {
        // If about 1 hour has passed and the wallet still no longer
        // has the txHash, we consider the deposit failed.
        cancelledDeposits.push(deposit);
      }
    }

    else if (walletHeight >= depositTx.blockHeight + serviceConfig.txConfirmations) {
      successfulDeposits.push(deposit);
    }
  }

  if (cancelledDeposits.length > 0) {
    await Promise.all(cancelledDeposits.map(d => completeCancelledDeposit(d)));
  }

  if (successfulDeposits.length > 0) {
    await Promise.all(successfulDeposits.map(d => completeSuccessfulDeposit(d)));
  }
}

async function completeSuccessfulDeposit(deposit: Deposit): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn) => {
      const userDocRef    = admin.firestore().doc(`apps/${deposit.appId}/users/${deposit.userId}`);
      const depositDocRef = admin.firestore().doc(`apps/${deposit.appId}/deposits/${deposit.id}`);
      const depositDoc    = await txn.get(depositDocRef);

      if (!depositDoc.exists) {
        throw new Error('deposit document does not exist.');
      }

      const depositRecord = depositDoc.data() as Deposit;

      if (depositRecord.status !== 'confirming') {
        throw new Error('deposit not in confirming state.');
      }

      const userDoc = await txn.get(userDocRef);
      const user    = userDoc.data() as AppUser;

      const userUpdate: AppUserUpdate = {
        balanceUnlocked:  user.balanceUnlocked + depositRecord.amount,
        balanceLocked:    user.balanceLocked - depositRecord.amount
      }

      const depositUpdate: AppDepositUpdate = {
        status:       'completed',
        userCredited: true,
        lastUpdate:   Date.now()
      }

      txn.update(userDocRef, userUpdate);
      txn.update(depositDocRef, depositUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}

async function completeCancelledDeposit(deposit: Deposit): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn) => {
      const userDocRef    = admin.firestore().doc(`apps/${deposit.appId}/users/${deposit.userId}`);
      const depositDocRef = admin.firestore().doc(`apps/${deposit.appId}/deposits/${deposit.id}`);
      const depositDoc    = await txn.get(depositDocRef);

      if (!depositDoc.exists) {
        throw new Error('deposit document does not exist.');
      }

      const depositRecord = depositDoc.data() as Deposit;

      if (depositRecord.status !== 'confirming') {
        throw new Error('deposit not in confirming state.');
      }

      const userDoc     = await txn.get(userDocRef);
      const user        = userDoc.data() as AppUser;
      const FieldValue  = require('firebase-admin').firestore.FieldValue;

      const userUpdate: AppUserUpdate = {
        balanceLocked: user.balanceLocked - depositRecord.amount
      }

      const depositUpdate: AppDepositUpdate = {
        status:       'completed',
        cancelled:    true,
        userCredited: false,
        lastUpdate:   Date.now(),
        txHash:       FieldValue.delete()
      }

      txn.update(userDocRef, userUpdate);
      txn.update(depositDocRef, depositUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}

function createDepositObject(
  id: string,
  appId: string,
  paymentId: string,
  depositAddress: string,
  integratedAddress: string,
  userId: string,
  amount: number,
  txHash: string,
  blockHeight: number): Deposit {

  const timestamp = Date.now();

  const deposit: Deposit = {
    id: id,
    appId,
    userId,
    blockHeight,
    paymentId,
    depositAddress,
    amount,
    integratedAddress,
    txHash: txHash,
    createdDate: timestamp,
    status: 'confirming',
    userCredited: false,
    lastUpdate: timestamp,
    cancelled: false
  };

  return deposit;
}
