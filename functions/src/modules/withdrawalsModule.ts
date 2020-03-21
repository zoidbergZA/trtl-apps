import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as WalletManager from '../walletManager';
import * as AppModule from './appsModule';
import * as ServiceModule from './serviceModule';
import * as Analytics from './analyticsModule';
import { serviceChargesAccountId } from '../constants';
import { ServiceError } from '../serviceError';
import { createCallback, CallbackCode } from './webhookModule';
import { Account, AccountUpdate, TurtleApp, Withdrawal, WithdrawalUpdate,
  ServiceCharge, ServiceChargeUpdate, PreparedWithdrawal,
  PreparedWithdrawalUpdate,
  Fees,
  DaemonErrorEvent} from '../../../shared/types';
import { generateRandomSignatureSegement } from '../utils';
import { ServiceConfig, ServiceWallet } from '../types';
import { Transaction, PreparedTransaction, SendTransactionResult } from 'turtlecoin-wallet-backend/dist/lib/Types';
import { WalletErrorCode, WalletError } from 'turtlecoin-wallet-backend';
import { FeeType } from 'turtlecoin-wallet-backend/dist/lib/FeeType';

exports.onWithdrawalCreated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onCreate(async (snapshot, context) => {
  const state = snapshot.data() as Withdrawal;
  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.log((error as ServiceError).message);
    return;
  }

  await processPendingWithdrawal(state, serviceWallet);
});

exports.onWithdrawalUpdated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Withdrawal;
  const newState  = change.after.data() as Withdrawal;

  await processWithdrawalUpdate(oldState, newState);
});

exports.onWithdrawalWrite = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onWrite(async (change, context) => {
  const newState = change.after.data();

  if (!newState) {
    return;
  }

  const historyRef = `/apps/${context.params.appId}/withdrawals/${context.params.withdrawalId}/withdrawalHistory`;

  await admin.firestore().collection(historyRef).add(newState);
});

export async function createPreparedWithdrawal(
  app: TurtleApp,
  account: Account,
  amount: number,
  address: string
): Promise<[PreparedWithdrawal | undefined, undefined | ServiceError]> {
  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.error(`failed to get service wallet: ${(configError as ServiceError)}`);
    return [undefined, new ServiceError('service/unknown-error')];
  }

  const serviceCharge = serviceConfig.serviceCharge;

  if (account.balanceUnlocked < (amount + serviceCharge)) {
    return [undefined, new ServiceError('transfer/insufficient-funds')];
  }

  const paymentId = account.spendSignaturePrefix.concat(generateRandomSignatureSegement());

  const [prepareTxResult, serviceError] = await WalletManager.prepareAccountTransaction(
                                            serviceConfig,
                                            app.subWallet,
                                            account.id,
                                            address,
                                            paymentId,
                                            amount);

  if (!prepareTxResult) {
    console.log((serviceError as ServiceError));
    return [undefined, serviceError];
  }

  if (prepareTxResult.transactionHash &&
      prepareTxResult.preparedTransaction &&
      prepareTxResult.fee !== undefined &&
      prepareTxResult.nodeFee !== undefined) {

    const txFee           = prepareTxResult.fee;
    const timestamp       = Date.now();
    const preparedDocRef  = admin.firestore().collection(`apps/${app.appId}/preparedWithdrawals`).doc();
    const preparedTxJson  = JSON.stringify(prepareTxResult.preparedTransaction);

    const fees: Fees = {
      txFee: txFee,
      nodeFee: prepareTxResult.nodeFee,
      serviceFee: serviceCharge
    }

    const preparedWithdrawal: PreparedWithdrawal = {
      id:             preparedDocRef.id,
      appId:          app.appId,
      accountId:      account.id,
      preparedTxJson: preparedTxJson,
      timestamp:      timestamp,
      lastUpdate:     timestamp,
      status:         'ready',
      address:        address,
      amount:         amount,
      fees:           fees,
      paymentId:      paymentId,
      txHash:         prepareTxResult.transactionHash
    }

    try {
      await preparedDocRef.create(preparedWithdrawal);
    } catch (error) {
      console.log(error);
      return [undefined, new ServiceError('service/unknown-error', prepareTxResult.error.toString())];
    }

    return [preparedWithdrawal, undefined];
  } else {
    const e = new WalletError(prepareTxResult.error.errorCode);

    const sendErrorMessage = e.toString();
    console.log(`send error: [${prepareTxResult.error.errorCode}] ${sendErrorMessage}`);
    return [undefined, new ServiceError('service/unknown-error', sendErrorMessage)];
  }
}

export async function getPreparedWithdrawal(
  appId: string,
  preparedWithdrawalId: string): Promise<[PreparedWithdrawal | undefined, undefined | ServiceError]> {

  const preparedDocRef  = admin.firestore().doc(`apps/${appId}/preparedWithdrawals/${preparedWithdrawalId}`);
  const preparedDoc     = await preparedDocRef.get();

  if (!preparedDoc.exists) {
    return [undefined, new ServiceError('app/prepared-withdrawal-not-found')];
  }

  const preparedWithdrawal = preparedDoc.data() as PreparedWithdrawal;

  if (preparedWithdrawal.status !== 'ready') {
    return [undefined, new ServiceError('app/invalid-prepared-withdrawal', `invalid status: ${preparedWithdrawal.status}`)];
  }

  return [preparedWithdrawal, undefined];
}

export async function processPreparedWithdrawal(
  preparedWithdrawal: PreparedWithdrawal,
  serviceConfig: ServiceConfig): Promise<[Withdrawal | undefined, undefined | ServiceError]> {

  const appId = preparedWithdrawal.appId;
  const preparedTransaction = JSON.parse(preparedWithdrawal.preparedTxJson) as PreparedTransaction;

  if (!preparedTransaction) {
    return [undefined, new ServiceError('app/invalid-prepared-withdrawal')];
  }

  const withdrawalAccountDoc = await admin.firestore().doc(`apps/${appId}/accounts/${preparedWithdrawal.accountId}`).get();

  if (!withdrawalAccountDoc.exists) {
    return [undefined, new ServiceError('app/account-not-found')];
  }

  const withdrawalAccount = withdrawalAccountDoc.data() as Account;
  const totalAmount       = getTotalAmount(preparedWithdrawal);

  if (withdrawalAccount.balanceUnlocked < totalAmount) {
    return [undefined, new ServiceError('transfer/insufficient-funds')];
  }

  try {
    const withdrawal = await executePreparedWithdrawal(preparedWithdrawal, serviceConfig);
    return [withdrawal, undefined];
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('service/unknown-error', error)];
  }
}

export async function processPendingWithdrawal(withdrawal: Withdrawal, serviceWallet: ServiceWallet): Promise<void> {
  const [sendTxResult, sendError] = await sendPendingWithdrawal(withdrawal, serviceWallet);

  if (!sendTxResult) {
    const errorMsg = (sendError as ServiceError).message;
    console.log(`error trying to send tx for withdrawal ${withdrawal.id} => ${errorMsg}`);

    await cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
    return;
  }

  if (sendTxResult.success) {
    if (sendTxResult.fee) {
      Analytics.trackMetric('withdrawal tx fee', sendTxResult.fee * 0.01);
    }

    console.log(`tx for withdrawal ${withdrawal.id} successfully sent with hash: ${sendTxResult.transactionHash}`);
  } else {
    await handleFaultyWithdrawalSend(withdrawal, sendTxResult.error, serviceWallet.serviceConfig);
  }
}

export async function getAccountWithdrawals(
  appId: string,
  accountId: string,
  limit: number): Promise<[Withdrawal[] | undefined, undefined | ServiceError]> {

  const snapshot = await admin.firestore()
                  .collection(`apps/${appId}/withdrawals`)
                  .where('accountId', '==', accountId)
                  .orderBy('timestamp', 'desc')
                  .limit(limit)
                  .get();

  const withdrawals = snapshot.docs.map(d => d.data() as Withdrawal);
  return [withdrawals, undefined];
}

export async function getWithdrawal(
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

export async function updateWithdrawals(serviceWallet: ServiceWallet): Promise<void> {
  const [walletHeight,,]  = serviceWallet.wallet.getSyncStatus();
  const scanHeight        = Math.max(0, serviceWallet.serviceConfig.txScanDepth);

  const transactions = serviceWallet.wallet
                        .getTransactions(undefined, undefined, false)
                        .filter(tx => {
                          const transfers = Array.from(tx.transfers.values());

                          // tx must be above scan height and contain at least one negative amount transfer
                          return tx.blockHeight >= scanHeight && transfers.find(t => t < 0)
                        });

  // Retry 'pending' withdrawals that have not been updated in at least 1 min.
  const pendingCutoff = Date.now() - (1 * 60 * 1000);

  const pendingDocs = await admin.firestore()
                      .collectionGroup('withdrawals')
                      .where('status', '==', 'pending')
                      .where('lastUpdate', '<', pendingCutoff)
                      .get();

  if (pendingDocs.size > 0) {
    const pendingWithdrawals = pendingDocs.docs.map(d => d.data() as Withdrawal);
    const processList: Withdrawal[] = [];

    // process 1 withdrawal per app at a time
    pendingWithdrawals.forEach(w => {
      if (!processList.find(item => item.appId === item.appId)) {
        processList.push(w);
      }
    });

    const processPendingPromises = processList.map(withdrawal => processPendingWithdrawal(withdrawal, serviceWallet));

    await Promise.all(processPendingPromises);
  }

  // Process faulty withdrawals
  const faultyDocs = await admin.firestore()
                      .collectionGroup('withdrawals')
                      .where('status', '==', 'faulty')
                      .get();

  if (faultyDocs.size > 0) {
    const faultyWithdrawals = faultyDocs.docs.map(d => d.data() as Withdrawal);

    const processFaultyPromises = faultyWithdrawals.map(withdrawal =>
                                    processFaultyWithdrawal(
                                      withdrawal,
                                      serviceWallet,
                                      transactions,
                                      walletHeight));

    await Promise.all(processFaultyPromises);
  }

  // Process confirming withdrawals
  const confirmingDocs = await admin.firestore()
                          .collectionGroup('withdrawals')
                          .where('status', '==', 'confirming')
                          .get();

  if (confirmingDocs.size > 0) {
    const confirmingWithdrawals = confirmingDocs.docs.map(d => d.data() as Withdrawal);

    const processConfirmingPromises = confirmingWithdrawals.map(withdrawal =>
                                        processConfirmingWithdrawal(
                                          withdrawal,
                                          serviceWallet.serviceConfig,
                                          transactions,
                                          walletHeight));

    await Promise.all(processConfirmingPromises);
  }
}

export async function processLostWithdrawals(serviceWallet: ServiceWallet): Promise<void> {
  const withdrawalDocs = await admin.firestore()
                          .collectionGroup('withdrawals')
                          .where('status', '==', 'lost')
                          .get();

  if (withdrawalDocs.size === 0) {
    return;
  }

  const lostWithdrawals = withdrawalDocs.docs.map(d => d.data() as Withdrawal);

  const promises = lostWithdrawals.map(withdrawal =>
                    processLostWithdrawal(withdrawal, serviceWallet));

  await Promise.all(promises);
}

export async function processWithdrawalUpdate(
  oldState: Withdrawal,
  newState: Withdrawal): Promise<void> {

  if (oldState.status !== 'pending' && newState.status === 'pending') {
    const [serviceWallet, error] = await WalletManager.getServiceWallet();

    if (serviceWallet) {
      await processPendingWithdrawal(newState, serviceWallet);
    } else {
      console.log((error as ServiceError).message);
    }
  }

  if (oldState.status !== 'completed' && newState.status === 'completed') {
    const [app, error] = await AppModule.getApp(oldState.appId);

    if (!app) {
      console.error((error as ServiceError).message);
      return;
    }

    const callbackCode: CallbackCode = newState.failed ? 'withdrawal/failed' : 'withdrawal/succeeded';

    await createCallback(app, callbackCode, newState);
  }
}

export async function getWithdrawalHistory(withdrawalId: string): Promise<[Withdrawal[] | undefined, undefined | ServiceError]> {
  const query = await admin.firestore()
                  .collectionGroup('withdrawalHistory')
                  .where('id', '==', withdrawalId)
                  .orderBy('lastUpdate', 'desc')
                  .get();

  if (query.size === 0) {
    return [undefined, new ServiceError('app/withdrawal-not-found')];
  }

  const history = query.docs.map(d => d.data() as Withdrawal);

  return [history, undefined];
}

async function processLostWithdrawal(withdrawal: Withdrawal, serviceWallet: ServiceWallet): Promise<any> {
  const [walletHeight, ,] = serviceWallet.wallet.getSyncStatus();

  // a lost withdrawal can be safely cancelled based on some node error codes.
  if (hasConfirmedFailureErrorCode(withdrawal)) {
    return cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
  }

  const transactions = serviceWallet.wallet
                        .getTransactions(undefined, undefined, false)
                        .filter(tx => {
                          const transfers = Array.from(tx.transfers.values());

                          // transfers must contain at least one negative amount transfer
                          return transfers.find(t => t < 0)
                        });

  // it can be completed if we find it's payment ID in the wallet and it has needed confirmations
  const transaction = transactions.find(tx => tx.paymentID === withdrawal.paymentId);

  if (transaction) {
    const blockHeight = transaction.blockHeight;

    if (blockHeight !== 0) {
      const confirmationsNeeded = serviceWallet.serviceConfig.txConfirmations;
      const completionHeight    = blockHeight + confirmationsNeeded;

      if (walletHeight >= completionHeight) {
        return processSuccessfulWithdrawal(withdrawal, transaction);
      }
    }
  }
}

async function processFaultyWithdrawal(
  withdrawal: Withdrawal,
  serviceWallet: ServiceWallet,
  transactions: Transaction[],
  walletHeight: number): Promise<any> {

  // a Faulty withdrawal can recover to 'confirming' if we can find it's payment ID in the wallet txs.
  const tx = transactions.find(t => t.paymentID === withdrawal.paymentId);

  if (tx) {
    const updateObject: WithdrawalUpdate = {
      lastUpdate: Date.now(),
      status: 'confirming'
    }

    return await admin.firestore().doc(`apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`).update(updateObject);
  }

  if (hasConfirmedFailureErrorCode(withdrawal)) {
    await cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
    return;
  } else if (withdrawal.retries < 5) {
    // retry with a new prepared withdrawal
    // TODO: refactor max retries var to service config
    return await retryFaultyWithdrawal(withdrawal, serviceWallet);
  }

  // The withdrawal will be marked as lost after the wallet height exceeds withdrawTimoutBlocks
  if (walletHeight > (withdrawal.requestedAtBlock + serviceWallet.serviceConfig.withdrawTimoutBlocks)) {
    await markLostWithdrawal(withdrawal.appId, withdrawal.id);
  }
}

async function retryFaultyWithdrawal(withdrawal: Withdrawal, serviceWallet: ServiceWallet): Promise<any> {
  console.log(`retrying faulty withdrawal: ${withdrawal.id}`);

  const withdrawalDocRef  = admin.firestore().doc(`apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`);
  const preparedDocRef    = admin.firestore().doc(`apps/${withdrawal.appId}/preparedWithdrawals/${withdrawal.preparedWithdrawalId}`);
  const preparedDoc       = await preparedDocRef.get();

  if (!preparedDoc.exists) {
    return [undefined, new ServiceError('app/prepared-withdrawal-not-found')];
  }

  const preparedWithdrawal = preparedDoc.data() as PreparedWithdrawal;

  if (preparedWithdrawal.status !== 'sent') {
    return [undefined, new ServiceError('app/invalid-prepared-withdrawal', `invalid status: ${preparedWithdrawal.status}`)];
  }

  const destinations: [string, number][] = [
    [withdrawal.address, withdrawal.amount]
  ];

  const [app, appError] = await AppModule.getApp(withdrawal.appId);

  if (!app) {
    console.log(`app error: ${(appError as ServiceError).message}`);
    return;
  }

  const txFee = FeeType.FixedFee(preparedWithdrawal.fees.txFee);

  const sendResult = await serviceWallet.wallet.sendTransactionAdvanced(
                      destinations,
                      undefined,
                      txFee,
                      preparedWithdrawal.paymentId,
                      [app.subWallet],
                      app.subWallet,
                      false);

  if (!sendResult.success) {
    const sendErrorMessage = sendResult.error.toString();
    console.log(`send error: [${sendResult.error.errorCode}] ${sendErrorMessage}`);

    const withdrawalUpdate: WithdrawalUpdate = {
      lastUpdate: Date.now(),
      retries: withdrawal.retries + 1
    }

    await withdrawalDocRef.update(withdrawalUpdate);

    return [undefined, new ServiceError('service/unknown-error', sendErrorMessage)];
  }

  if (sendResult.transactionHash && sendResult.preparedTransaction && sendResult.fee !== undefined) {
    const timestamp = Date.now();
    const preparedTxJson = JSON.stringify(sendResult.preparedTransaction);

    const preparedWithdrawalUpdate: PreparedWithdrawalUpdate = {
      preparedTxJson: preparedTxJson,
      lastUpdate:     timestamp,
      txHash:         sendResult.transactionHash
    }

    const withdrawalUpdate: WithdrawalUpdate = {
      lastUpdate: timestamp,
      txHash: sendResult.transactionHash,
      retries: withdrawal.retries + 1,
      status: 'pending',
      daemonErrorCode: 0
    }

    try {
      const preparedPromise = preparedDocRef.update(preparedWithdrawalUpdate);
      const withdrawalPromise = withdrawalDocRef.update(withdrawalUpdate);

      await Promise.all([preparedPromise, withdrawalPromise]);

      console.log(`retrying faulty withdrawal with new prepared tx, status has been reset to pending.`);
    } catch (error) {
      console.log(error);
      return [undefined, new ServiceError('service/unknown-error')];
    }
  }
}

function hasConfirmedFailureErrorCode(withdrawal: Withdrawal): boolean {

  if (!withdrawal.daemonErrorCode) {
    return false;
  }

  switch (withdrawal.daemonErrorCode) {
    case WalletErrorCode.NOT_ENOUGH_BALANCE:
      /* Amount + fee is greater than the total balance available in the
          subwallets specified (or all wallets, if not specified) */
      return true;
    case WalletErrorCode.DAEMON_ERROR:
      /* An error occured whilst the daemon processed the request. Possibly our
       software is outdated, the daemon is faulty, or there is a programmer
       error. Check your daemon logs for more info. (set_log 4)
       Often caused by trying to use already spent inputs */
       return true;
    case WalletErrorCode.PREPARED_TRANSACTION_EXPIRED:
      /* Prepared transaction is no longer valid, inputs have been consumed by other transactions. */
      return true;
    case WalletErrorCode.PREPARED_TRANSACTION_NOT_FOUND:
      /* Prepared transaction cannot be found, perhaps wallet application has been restarted */
      return true;
    default:
      Analytics.trackEvent('unhandled wallet error', {
        walletErrorCode: withdrawal.daemonErrorCode.toString(),
        withdrawalId: withdrawal.id,
        timestamp: Date.now().toString()
      });

      return false;
  }
}

async function processConfirmingWithdrawal(
  withdrawal: Withdrawal,
  serviceConfig: ServiceConfig,
  transactions: Transaction[],
  walletHeight: number): Promise<any> {

  const withdrawalPath  = `apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`;
  const transaction     = transactions.find(tx => tx.paymentID === withdrawal.paymentId);

  console.log(`process confirming withdrawal => hash [${withdrawal.txHash}]`);

  if (transaction) {
    const blockHeight = transaction.blockHeight;

    if (blockHeight !== 0) {
      const completionHeight = blockHeight + serviceConfig.txConfirmations;

      if (walletHeight >= completionHeight) {
        return processSuccessfulWithdrawal(withdrawal, transaction);
      } else {
        // transaction is included in a block, waiting for confirmations.
        if (withdrawal.blockHeight !== blockHeight) {
          const withdrawalUpdate: WithdrawalUpdate = {
            lastUpdate: Date.now(),
            blockHeight: blockHeight
          };

          await admin.firestore().doc(withdrawalPath).update(withdrawalUpdate);
        }
      }
    }
  } else {
    console.log(`confirming withdrawal not found in wallet transactions => hash [${withdrawal.txHash}]`);

    // check if the withdrawal request failed
    const failureHeight = withdrawal.requestedAtBlock + serviceConfig.withdrawTimoutBlocks;

    if (walletHeight >= failureHeight) {
      return cancelFailedWithdrawal(withdrawal.appId, withdrawal.id);
    }
  }
}

async function processSuccessfulWithdrawal(withdrawal: Withdrawal, transaction: Transaction): Promise<void> {
  const [app, appError] = await AppModule.getApp(withdrawal.appId);

  if (!app) {
    console.error(`failed to find app for completed witdhrawal: ${(appError as ServiceError).message}`);
    return;
  }

  const withdrawalPath = `apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`;

  const withdrawalUpdate: WithdrawalUpdate = {
    lastUpdate:   Date.now(),
    status:       'completed',
    blockHeight:  transaction.blockHeight
  };

  await admin.firestore().doc(withdrawalPath).update(withdrawalUpdate);

  if (withdrawal.serviceChargeId) {
    try {
      const chargeUpdate: ServiceChargeUpdate = {
        lastUpdate: Date.now(),
        status: 'processing'
      }

      await admin.firestore()
                  .doc(`apps/${withdrawal.appId}/serviceCharges/${withdrawal.serviceChargeId}`)
                  .update(chargeUpdate);
    } catch (error) {
      console.error(`error updating withdrawal [${withdrawal.id}] service charge doc with id [${withdrawal.serviceChargeId}]!`);
    }
  }
}

async function markLostWithdrawal(appId: string, withdrawalId: string): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn): Promise<any> => {
      const withdrawalDocRef  = admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);

      if (!withdrawalDoc.exists) {
        return Promise.reject('withdrawal doc does not exist.');
      }

      const withdrawalUpdate: WithdrawalUpdate = {
        status:       'lost',
        lastUpdate:   Date.now()
      }

      txn.update(withdrawalDocRef, withdrawalUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}

async function cancelFailedWithdrawal(appId: string, withdrawalId: string): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn): Promise<any> => {
      const withdrawalDocRef  = admin.firestore().doc(`apps/${appId}/withdrawals/${withdrawalId}`);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);

      if (!withdrawalDoc.exists) {
        return Promise.reject('withdrawal doc does not exist.');
      }

      const withdrawal        = withdrawalDoc.data() as Withdrawal;
      const totalFees         = withdrawal.fees.txFee + withdrawal.fees.nodeFee + withdrawal.fees.serviceFee;
      const totalAmount       = withdrawal.amount + totalFees;
      const serviceChargeId   = withdrawal.serviceChargeId;
      const accountDocRef     = admin.firestore().doc(`apps/${appId}/accounts/${withdrawal.accountId}`);
      const accountDoc        = await txn.get(accountDocRef);

      if (!accountDoc.exists) {
        return Promise.reject('account doc does not exist.');
      }

      const account = accountDoc.data() as Account;
      let serviceCharge: ServiceCharge | undefined;

      if (serviceChargeId) {
        const chargeDocRef    = admin.firestore().doc(`apps/${appId}/serviceCharges/${serviceChargeId}`);
        const chargeDoc       = await txn.get(chargeDocRef);

        if (!chargeDoc.exists) {
          return Promise.reject('service charge doc does not exist.');
        }

        serviceCharge = chargeDoc.data() as ServiceCharge;

        if (serviceCharge.cancelled) {
          return Promise.reject('service charge already cancelled.');
        }

        const serviceChargeUpdate: ServiceChargeUpdate = {
          lastUpdate: Date.now(),
          cancelled: true,
          status: 'processing'
        }

        txn.update(chargeDocRef, serviceChargeUpdate);
      }

      const withdrawalUpdate: WithdrawalUpdate = {
        status:       'completed',
        failed:       true,
        userDebited:  false,
        lastUpdate:   Date.now()
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

function getTotalAmount(preparedWithdrawal: PreparedWithdrawal): number {
  const fees      = preparedWithdrawal.fees;
  const totalFees = fees.txFee + fees.nodeFee + fees.serviceFee;

  return preparedWithdrawal.amount + totalFees;
}

async function executePreparedWithdrawal(
  preparedWithdrawal: PreparedWithdrawal,
  serviceConfig: ServiceConfig): Promise<Withdrawal> {

  const appId       = preparedWithdrawal.appId;
  const withdrawDoc = admin.firestore().collection(`apps/${appId}/withdrawals`).doc();
  const timestamp   = Date.now();

  const withdrawal: Withdrawal = {
    id:                   withdrawDoc.id,
    paymentId:            preparedWithdrawal.paymentId,
    txHash:               preparedWithdrawal.txHash,
    status:               'pending',
    blockHeight:          0,
    appId:                preparedWithdrawal.appId,
    accountId:            preparedWithdrawal.accountId,
    amount:               preparedWithdrawal.amount,
    fees:                 preparedWithdrawal.fees,
    address:              preparedWithdrawal.address,
    preparedWithdrawalId: preparedWithdrawal.id,
    requestedAtBlock:     0,
    timestamp:            timestamp,
    lastUpdate:           timestamp,
    failed:               false,
    userDebited:          true,
    retries:              0
  };

  await admin.firestore().runTransaction(async (txn): Promise<any> => {
    const accountDocRef = admin.firestore().doc(`apps/${appId}/accounts/${withdrawal.accountId}`);
    const accountDoc    = await txn.get(accountDocRef);
    const account       = accountDoc.data() as Account;
    const totalAmount   = getTotalAmount(preparedWithdrawal);

    if (account.balanceUnlocked < totalAmount) {
      return Promise.reject('insufficient unlocked funds.');
    }

    if (withdrawal.fees.serviceFee > 0) {
      withdrawal.serviceChargeId = await processServiceCharge(withdrawal, serviceConfig, txn);
    }

    const accountUpdate: AccountUpdate = {
      balanceUnlocked: account.balanceUnlocked - totalAmount
    }

    const preparedWithdrawalUpdate: PreparedWithdrawalUpdate = {
      lastUpdate: timestamp,
      status: 'sent'
    }

    const preparedDocRef = admin.firestore().doc(`apps/${appId}/preparedWithdrawals/${preparedWithdrawal.id}`);

    txn.create(withdrawDoc, withdrawal);
    txn.update(accountDocRef, accountUpdate);
    txn.update(preparedDocRef, preparedWithdrawalUpdate);
  });

  return withdrawal;
}

async function processServiceCharge(
  withdrawal: Withdrawal,
  serviceConfig: ServiceConfig,
  txn: FirebaseFirestore.Transaction): Promise<string> {

  const appId     = withdrawal.appId;
  const timestamp = Date.now();

  const serviceChargeDocRef = admin.firestore().collection(`apps/${appId}/serviceCharges`).doc();
  const chargeAccountDocRef = admin.firestore().doc(`apps/${appId}/serviceAccounts/${serviceChargesAccountId}`);
  const chargeAccountDoc    = await txn.get(chargeAccountDocRef);

  const serviceCharge: ServiceCharge = {
    id:                 serviceChargeDocRef.id,
    appId:              withdrawal.appId,
    type:               'withdrawal',
    withdrawalId:       withdrawal.id,
    timestamp:          timestamp,
    amount:             serviceConfig.serviceCharge,
    chargedAccountId:   withdrawal.accountId,
    lastUpdate:         timestamp,
    cancelled:          false,
    status:             'confirming'
  }

  if (!chargeAccountDoc.exists) {
    return Promise.reject('service charge account not found.');
  }

  const chargeAccount = chargeAccountDoc.data() as Account;

  const chargeAccountUpdate: AccountUpdate = {
    balanceLocked: chargeAccount.balanceLocked + withdrawal.fees.serviceFee
  }

  txn.update(chargeAccountDocRef, chargeAccountUpdate);
  txn.create(serviceChargeDocRef, serviceCharge);

  return serviceCharge.id;
}

async function sendPendingWithdrawal(
  pendingWithdrawal: Withdrawal,
  serviceWallet: ServiceWallet): Promise<[SendTransactionResult | undefined, undefined | ServiceError]> {

  let txHash: string | undefined;

  try {
    txHash = await admin.firestore().runTransaction(async (txn): Promise<string> => {
      const preparedDocRef    = admin.firestore().doc(`apps/${pendingWithdrawal.appId}/preparedWithdrawals/${pendingWithdrawal.preparedWithdrawalId}`);
      const withdrawalDocRef  = admin.firestore().doc(`apps/${pendingWithdrawal.appId}/withdrawals/${pendingWithdrawal.id}`);
      const preparedDoc       = await txn.get(preparedDocRef);
      const withdrawalDoc     = await txn.get(withdrawalDocRef);

      if (!preparedDoc.exists) {
        const msg = `unabled to find prepared withdrawal with id: ${pendingWithdrawal.preparedWithdrawalId}`;
        console.error(msg);
        return Promise.reject(msg);
      }

      if (!withdrawalDoc.exists) {
        const msg = `withdrawal ${pendingWithdrawal.id} not found, skipping further processing.`;
        console.error(msg);
        return Promise.reject(msg);
      }

      const preparedWithdrawal  = preparedDoc.data() as PreparedWithdrawal;
      const withdrawal          = withdrawalDoc.data() as Withdrawal;

      if (withdrawal.status !== 'pending') {
        const msg = `new withdrawal request ${pendingWithdrawal.id} not in pending state, skipping further processing.`;
        console.error(msg);
        return Promise.reject(msg);
      }

      const [walletBlockCount, ,] = serviceWallet.wallet.getSyncStatus();

      const confirmingUpdate: WithdrawalUpdate = {
        lastUpdate: Date.now(),
        status: 'confirming',
        requestedAtBlock: walletBlockCount
      }

      txn.update(withdrawalDocRef, confirmingUpdate);

      return Promise.resolve(preparedWithdrawal.txHash);
    });
  } catch (error) {
    if (!txHash) {
      return [undefined, new ServiceError('service/unknown-error', error)];
    }
  }

  return await WalletManager.sendPreparedTransaction(txHash, serviceWallet.serviceConfig);
}

async function handleFaultyWithdrawalSend(
  withdrawal: Withdrawal,
  sendError: WalletError,
  serviceConfig: ServiceConfig): Promise<void> {

  console.log(`${withdrawal.id} send error: ${JSON.stringify(sendError)}`);

  const withdrawalDocRef = admin.firestore().doc(`apps/${withdrawal.appId}/withdrawals/${withdrawal.id}`);

  const txSentUpdate: WithdrawalUpdate = {
    lastUpdate: Date.now(),
    status: 'faulty',
    daemonErrorCode: sendError.errorCode
  }

  await withdrawalDocRef.update(txSentUpdate);

  const errorDocRef = admin.firestore().collection('admin/reports/daemonErrors').doc();

  const errorEvent: DaemonErrorEvent = {
    id: errorDocRef.id,
    timestamp: Date.now(),
    appId: withdrawal.appId,
    accountId: withdrawal.accountId,
    preparedWithdrawalId: withdrawal.id,
    daemonErrorCode: sendError.errorCode,
    nodeUrl: serviceConfig.daemonHost,
    port: serviceConfig.daemonPort
  }

  await errorDocRef.set(errorEvent);

  Analytics.trackEvent('withdrawal daemon error', {
    name: "withdrawal daemon error",
    properties: {
      errorCode: sendError.errorCode.toString()
    }
  });
}
