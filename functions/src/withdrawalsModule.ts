import * as admin from 'firebase-admin';
import * as WalletManager from './walletManager';
import * as AppModule from './appModule';
import * as ServiceModule from './serviceModule';
import { ServiceError } from './serviceError';
import { createCallback, CallbackCode } from './webhookModule';
import { Account, AccountUpdate, TurtleApp, Withdrawal, WithdrawalUpdate } from '../../shared/types';
import { generateRandomSignatureSegement } from './utils';

export async function processWithdrawRequest(
  app: TurtleApp,
  appAccount: Account,
  amount: number,
  sendAddress: string): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);
    return [undefined, configError];
  }

  const fee = serviceConfig.nodeFee;
  const totalAmount = amount + fee;

  if (appAccount.balanceUnlocked < totalAmount) {
    return [undefined, new ServiceError('transfer/insufficient-funds')];
  }

  const paymentId   = appAccount.spendSignaturePrefix.concat(generateRandomSignatureSegement());
  const withdrawDoc = admin.firestore().collection(`apps/${app.appId}/withdrawals`).doc();
  const timestamp   = Date.now();

  const withdrawRequest: Withdrawal = {
    id:                 withdrawDoc.id,
    paymentId:          paymentId,
    status:             'pending',
    blockHeight:        0,
    appId:              app.appId,
    accountId:          appAccount.id,
    amount:             amount,
    fee:                fee,
    address:            sendAddress,
    requestedAtBlock:   0,
    timestamp:          timestamp,
    lastUpdate:         timestamp,
    failed:             false
  };

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const accountDocRef = admin.firestore().doc(`apps/${app.appId}/accounts/${appAccount.id}`);
      const accountDoc    = await txn.get(accountDocRef);
      const account       = accountDoc.data() as Account;

      if (account.balanceUnlocked >= totalAmount) {
        txn.update(accountDocRef, {
          balanceUnlocked: account.balanceUnlocked - totalAmount
        });

        txn.create(withdrawDoc, withdrawRequest);
      } else {
        throw new Error('insufficient unlocked funds.');
      }
    });
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('service/unknown-error')];
  }

  return [withdrawRequest, undefined];
}

export async function processPendingWithdrawal(withdrawal: Withdrawal): Promise<void> {
  const withdrawalDocRef = admin.firestore().doc(`apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`);

  if (withdrawal.status !== 'pending') {
    console.error(`new withdrawal request ${withdrawal.id} not in pending state, skipping further processing.`);
    return;
  }

  const [app, appError] = await AppModule.getApp(withdrawal.appId);

  if (!app) {
    console.log((appError as ServiceError).message);
    return;
  }

  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError)}`);
    return;
  }

  const [walletBlockCount, ,] = serviceWallet.wallet.getSyncStatus();

  const destinations: [string, number][] = [
    [withdrawal.address, withdrawal.amount]
  ];

  const confirmingUpdate: WithdrawalUpdate = {
    lastUpdate: Date.now(),
    status: 'confirming',
    requestedAtBlock: walletBlockCount
  }

  try {
    await withdrawalDocRef.update(confirmingUpdate);
  } catch (error) {
    console.log(error);
    return;
  }

  const [txHash, txError] = await serviceWallet.wallet.sendTransactionAdvanced(
      destinations,
      undefined,
      withdrawal.fee,
      withdrawal.paymentId,
      [app.subWallet],
      app.subWallet);

  if (txError) {
    console.log(txError);
  }

  if (txHash) {
    const hashUpdate: WithdrawalUpdate = {
      lastUpdate: Date.now(),
      txHash: txHash
    }

    await withdrawalDocRef.update(hashUpdate);
  }
}

export async function getWithdrawRequest(
  appId: string,
  withdrawalId: string): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

  const withdrawalDoc = await admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`).get();

  if (withdrawalDoc.exists) {
    const depositRequest = withdrawalDoc.data() as Withdrawal;
    return [depositRequest, undefined];
  } else {
    return [undefined, new ServiceError('app/withdrawal-not-found')];
  }
}

export async function updateWithdrawals(): Promise<void> {
  // Retry 'pending' withdrawals that have not been updated in at least 5 mins.
  const pendingCutoff = Date.now() - (5 * 60 * 1000);

  const pendingDocs = await admin.firestore()
  .collectionGroup('withdrawals')
  .where('status', '==', 'pending')
  .where('lastUpdate', '<', pendingCutoff)
  .get();

  if (pendingDocs.size > 0) {
    const pendingWithdrawals      = pendingDocs.docs.map(d => d.data() as Withdrawal);
    const processPendingPromises  = pendingWithdrawals.map(p => processPendingWithdrawal(p));

    await Promise.all(processPendingPromises);
  }

  const confirmingDocs = await admin.firestore()
  .collectionGroup('withdrawals')
  .where('status', '==', 'confirming')
  .get();

  if (confirmingDocs.size === 0) {
    return;
  }

  const confirmingWithdrawals = confirmingDocs.docs.map(d => d.data() as Withdrawal);
  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (error || !serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError).message}`);
    return;
  }

  const scanHeight = Math.max(
    0,
    serviceWallet.serviceConfig.txScanDepth
  );

  const transactions = serviceWallet.wallet
    .getTransactions(undefined, undefined, false)
    .filter(tx => {
      const transfers = Array.from(tx.transfers.values());

      // tx must be above scan height and contain at least one negative amount transfer
      return tx.blockHeight >= scanHeight && transfers.find(t => t < 0)
    });

  const [walletHeight,,] = serviceWallet.wallet.getSyncStatus();
  const promises: Promise<any>[] = [];

  confirmingWithdrawals.forEach(withdrawal => {
    const withdrawalPath = `apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`;
    const transaction = transactions.find(tx => tx.paymentID === withdrawal.paymentId);

    if (transaction) {
      const updateObject: WithdrawalUpdate = {
        lastUpdate: Date.now()
      };

      if (withdrawal.txHash !== transaction.hash) {
        updateObject.txHash = transaction.hash;
      }

      const blockHeight = transaction.blockHeight;

      if (withdrawal.blockHeight !== blockHeight) {
        updateObject.blockHeight = blockHeight;
      }

      if (blockHeight !== 0) {
        const confirmationsNeeded = serviceWallet.serviceConfig.txConfirmations;
        const completionHeight = blockHeight + confirmationsNeeded;

        if (walletHeight >= completionHeight) {
          updateObject.status = 'completed';
        } else {
          // transaction is included in a block, waiting for confirmations.
        }
      } else {
        // transaction not yet included in a block.
      }

      // if more than 'lastUpdate' key exists, something changed
      if (Object.keys(updateObject).length > 1) {
        promises.push(admin.firestore().doc(withdrawalPath).update(updateObject));
      }
    } else {
      // check if the withdrawal request failed
      const failureHeight = withdrawal.requestedAtBlock + serviceWallet.serviceConfig.withdrawTimoutBlocks;

      if (walletHeight >= failureHeight) {
        promises.push(cancelFailedWithdrawal(withdrawal.appId, withdrawal.id));
      }
    }
  });

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

export async function processWithdrawalUpdate(
  oldState: Withdrawal,
  newState: Withdrawal): Promise<void> {

  if (oldState.status === 'confirming' && newState.status === 'completed') {
    const [app, error] = await AppModule.getApp(oldState.appId);

    if (!app) {
      console.error((error as ServiceError).message);
      return;
    }

    const callbackCode: CallbackCode = newState.failed ? 'withdrawal/failed' : 'withdrawal/succeeded';

    await createCallback(app, callbackCode, newState);
  }
}

async function cancelFailedWithdrawal(appId: string, withdrawalId: string): Promise<void> {
  // mark withdrawal as failed, credit the account with the withdrawal the amount + fee

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const withdrawalDocRef  = admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);
      const withdrawal        = withdrawalDoc.data() as Withdrawal;
      const totalAmount       = withdrawal.amount + withdrawal.fee;
      const accountDocRef     = admin.firestore().doc(`apps/${appId}/accounts/${withdrawal.accountId}`);
      const accountDoc        = await txn.get(accountDocRef);
      const account           = accountDoc.data() as Account;

      const withdrawalUpdate: WithdrawalUpdate = {
        status:     'completed',
        failed:     true,
        lastUpdate: Date.now()
      }

      const accountUpdate: AccountUpdate = {
        balanceUnlocked: account.balanceUnlocked + totalAmount
      }

      txn.update(withdrawalDocRef, withdrawalUpdate);
      txn.update(accountDocRef, accountUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}
