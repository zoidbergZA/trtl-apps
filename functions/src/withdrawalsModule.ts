import * as admin from 'firebase-admin';
import * as WalletManager from './walletManager';
import * as AppModule from './appModule';
import { ServiceError } from './serviceError';
import { createCallback, CallbackCode } from './webhookModule';
import { AppUser, AppUserUpdate, TurtleApp, Withdrawal, WithdrawalUpdate } from '../../shared/types';
import { generateRandomPaymentId } from './utils';

export async function processWithdrawRequest(
  app: TurtleApp,
  appUser: AppUser,
  amount: number,
  sendAddress: string): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError)}`);
    return [undefined, error];
  }

  const [walletBlockCount, ,] = serviceWallet.wallet.getSyncStatus();
  const fee = serviceWallet.serviceConfig.nodeFee;
  const totalAmount = amount + fee;

  console.log(`user [${appUser.userId}] withdraw amount: ${amount}, fee: ${fee}`);

  if (appUser.balanceUnlocked < totalAmount) {
    return [undefined, new ServiceError('transfer/insufficient-funds')];
  }

  const paymentId   = generateRandomPaymentId();
  const withdrawDoc = admin.firestore().collection(`apps/${app.appId}/withdrawals`).doc();
  const timestamp   = Date.now();

  const withdrawRequest: Withdrawal = {
    id:                 withdrawDoc.id,
    paymentId:          paymentId,
    status:             'confirming',
    blockHeight:        0,
    appId:              app.appId,
    userId:             appUser.userId,
    amount:             amount,
    fee:                fee,
    address:            sendAddress,
    requestedAtBlock:   walletBlockCount,
    timestamp:          timestamp,
    lastUpdate:         timestamp,
    failed:             false
  };

  let dbTransactionSucceeded = true;

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const userDocRef  = admin.firestore().doc(`apps/${app.appId}/users/${appUser.userId}`);
      const userDoc     = await txn.get(userDocRef);
      const user        = userDoc.data() as AppUser;

      if (user.balanceUnlocked >= amount) {
        txn.update(userDocRef, {
          balanceUnlocked: user.balanceUnlocked - totalAmount
        });

        txn.create(withdrawDoc, withdrawRequest);
      } else {
        throw new Error('insufficient unlocked funds.');
      }
    });

  } catch (error) {
    console.log(error);
    dbTransactionSucceeded = false;
  }

  if (dbTransactionSucceeded) {
    const destinations: [string, number][] = [
      [sendAddress, amount]
    ];

    const [txHash, txError] = await serviceWallet.wallet.sendTransactionAdvanced(
      destinations,
      undefined,
      fee,
      paymentId,
      [app.subWallet],
      app.subWallet);

    if (txHash) {
      await withdrawDoc.update({
        txHash: txHash
      });
    }

    if (txError && txError.errorCode !== 55) {
      // with error code 55 the tx may still succeed, otherwise mark withdrawal as failed immediately.
      // see WalletBackend docs: https://github.com/turtlecoin/turtlecoin-wallet-backend-js/blob/5574e08995f99fc750785ddb730001db7706083d/lib/WalletError.ts#L462
      console.warn(txError.toString());

      const cancelSucceeded = await cancelFailedWithdrawal(
                                withdrawRequest.appId,
                                withdrawRequest.id);

      if (!cancelSucceeded) {
        console.error(`failed to cancel withdrawal with ID: ${withdrawRequest.id}`);
      }

      return [undefined, new ServiceError('service/unknown-error')];
    }

    return [withdrawRequest, undefined];
  } else {
    return [undefined, new ServiceError('service/unknown-error')];
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
    .filter(tx => tx.blockHeight >= scanHeight);

  const [walletHeight,,] = serviceWallet.wallet.getSyncStatus();
  const promises: Promise<any>[] = [];

  confirmingWithdrawals.forEach(withdrawal => {
    const withdrawalPath = `apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`;
    const transaction = transactions.find(tx => tx.paymentID === withdrawal.paymentId);

    const updateObject: WithdrawalUpdate = {
      lastUpdate: Date.now()
    };

    if (transaction) {
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
    } else {
      // check if the withdrawal request failed
      const failureHeight = withdrawal.requestedAtBlock + serviceWallet.serviceConfig.withdrawTimoutBlocks;

      if (walletHeight >= failureHeight) {
        promises.push(cancelFailedWithdrawal(withdrawal.appId, withdrawal.id));
      }
    }

    // if only 'lastUpdate' key exists, nothing changed
    if (Object.keys(updateObject).length > 1) {
      promises.push(admin.firestore().doc(withdrawalPath).update(updateObject));
    }
  });

  if (promises.length > 0) {
    await Promise.all(promises);
  }
}

export async function processUserWithdrawalUpdate(
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

async function cancelFailedWithdrawal(appId: string, withdrawalId: string): Promise<boolean> {
  // mark withdrawal as failed, credit the user with the withdrawal the amount + fee
  let cancellationProcessed = true;

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const withdrawalDocRef  = admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);
      const withdrawal        = withdrawalDoc.data() as Withdrawal;
      const totalAmount       = withdrawal.amount + withdrawal.fee;
      const userDocRef        = admin.firestore().doc(`apps/${appId}/users/${withdrawal.userId}`);
      const userDoc           = await txn.get(userDocRef);
      const user              = userDoc.data() as AppUser;
      const FieldValue        = require('firebase-admin').firestore.FieldValue;

      const withdrawalUpdate: WithdrawalUpdate = {
        status:     'completed',
        failed:     true,
        lastUpdate: Date.now(),
        txHash:     FieldValue.delete()
      }

      const userUpdate: AppUserUpdate = {
        balanceUnlocked: user.balanceUnlocked + totalAmount
      }

      txn.update(withdrawalDocRef, withdrawalUpdate);
      txn.update(userDocRef, userUpdate);
    });
  } catch (error) {
    console.error(error);
    cancellationProcessed = false;
  }

  return cancellationProcessed;
}
