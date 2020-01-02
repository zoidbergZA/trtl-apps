import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as ServiceModule from './serviceModule';
import * as WalletManager from './walletManager';
import * as Utils from '../../shared/utils';
import { serviceChargesAccountId } from './constants';
import { createIntegratedAddress, WalletBackend } from 'turtlecoin-wallet-backend';
import { ServiceError } from './serviceError';
import { SubWalletInfo, SubWalletInfoUpdate, TurtleApp, TurtleAppUpdate, Deposit, Withdrawal, Account } from '../../shared/types';
import { generateRandomPaymentId, generateRandomSignatureSegement } from './utils';
import { AppAuditResult } from './types';
import { Transaction } from 'turtlecoin-wallet-backend/dist/lib/Types';

export async function createApp(
  owner: string,
  appName: string,
  inviteCode?: string) : Promise<[TurtleApp | undefined, undefined | ServiceError]> {

  const validName = Utils.validateAppName(appName);

  if (!validName) {
    return [undefined, new ServiceError('app/invalid-app-name')];
  }

  const querySnapshot = await admin.firestore().collection(`apps`).where('name', '==', appName).get();

  if (querySnapshot.docs.length > 0) {
    return [undefined, new ServiceError('app/invalid-app-name', 'An app with the same name already exists.')];
  }

  const [serviceConfig, serviceError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.log('failed to get service config.');
    return [undefined, serviceError];
  }

  const [wallet, walletError] = await WalletManager.getMasterWallet(serviceConfig);

  if (!wallet) {
    console.log('failed to get service wallet');
    return [undefined, walletError];
  }

  const unclaimedSubWallets = await WalletManager.getSubWalletInfos(true);

  if (unclaimedSubWallets.length === 0) {
    return [undefined, new ServiceError('service/no-unclaimed-subwallets')];
  }

  const selectedSubWallet = unclaimedSubWallets[Math.floor(Math.random() * unclaimedSubWallets.length)];
  let app: TurtleApp | undefined = undefined;

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const subWalletDocRef   = admin.firestore().doc(`wallets/master/subWallets/${selectedSubWallet.id}`);
      const appDocRef         = admin.firestore().collection('apps').doc();
      const appId             = appDocRef.id;
      const appSecret         = crypto.randomBytes(64).toString('hex');
      const timestamp         = Date.now();

      const subWalletDoc = await txn.get(subWalletDocRef);

      if (!subWalletDoc.exists) {
        console.log('subwallet document does not exist');
        throw new Error('subWallet document does not exist');
      }

      const subWalletInfo = subWalletDoc.data() as SubWalletInfo;

      if (subWalletInfo.claimed) {
        throw new Error(`subWallet with address ${subWalletInfo.address} is already claimed`);
      }

      app = {
        owner:            owner,
        appId:            appId,
        name:             appName,
        appSecret:        appSecret,
        subWallet:        subWalletInfo.address,
        publicKey:        subWalletInfo.publicSpendKey,
        createdAt:        timestamp,
        disabled:         false,
        lastAuditAt:      0,
        lastAuditPassed:  true
      }

      const subWalletInfoUpdate: SubWalletInfoUpdate = {
        claimed: true,
        appId: appId
      }

      const paymentId           = generateRandomPaymentId();
      const chargesAccountRef   = admin.firestore().doc(`apps/${appId}/serviceAccounts/${serviceChargesAccountId}`);
      const integratedAddress   = createIntegratedAddress(app.subWallet, paymentId);

      const chargesAccount: Account = {
        id: serviceChargesAccountId,
        appId: appId,
        balanceLocked: 0,
        balanceUnlocked: 0,
        createdAt: timestamp,
        deleted: false,
        paymentId: paymentId,
        spendSignaturePrefix: generateRandomSignatureSegement(),
        depositAddress: integratedAddress,
        depositQrCode: `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=turtlecoin://${integratedAddress}`
      }

      txn.create(appDocRef, app);
      txn.create(chargesAccountRef, chargesAccount);
      txn.update(subWalletDocRef, subWalletInfoUpdate);

      if (inviteCode) {
        const inviteCodeRef = admin.firestore().doc(`appInvites/${inviteCode}`);

        txn.update(inviteCodeRef, {
          claimed: true
        })
      }
    });
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('service/create-app-failed', error)];
  }

  if (app === undefined) {
    console.log('unknown error while create app.');
    return [undefined, new ServiceError('service/create-app-failed')];
  } else {
    return [app, undefined];
  }
}

export async function getApp(appId: string): Promise<[TurtleApp | undefined, undefined | ServiceError]> {
  const appDoc = await admin.firestore().doc(`apps/${appId}`).get();

  if (!appDoc.exists) {
    return [undefined, new ServiceError('app/app-not-found')];
  }

  return [appDoc.data() as TurtleApp, undefined];
}

export async function disableApp(appId: string, reason: string): Promise<void> {
  console.error(`disabled app [${appId}]. reason: ${reason}`);

  const appUpdate: TurtleAppUpdate = {
    disabled: true
  }

  await admin.firestore().doc(`apps/${appId}`).update(appUpdate);
}

export async function setAppWebhook(
  owner: string,
  appId: string,
  webhook: string | undefined): Promise<[string | undefined, undefined | ServiceError]> {

  const appDoc      = admin.firestore().doc(`apps/${appId}`);
  const appSnapshot = await appDoc.get();

  if (!appSnapshot.exists) {
    return [undefined, new ServiceError('app/app-not-found')];
  }

  const app = appSnapshot.data() as TurtleApp;

  if (owner !== app.owner) {
    return [undefined, new ServiceError('request/unauthorized')];
  }

  let newWebhook = webhook;

  if (webhook && webhook === '') {
    newWebhook = undefined;
  }

  try {
    if (!newWebhook) {
      const FieldValue = require('firebase-admin').firestore.FieldValue;
      await appDoc.update({ webhook: FieldValue.delete() });
    } else {
      await appDoc.update({ webhook: newWebhook });
    }

    return [newWebhook, undefined];
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('service/unknown-error', error.toString())];
  }
}

export async function runAppAudits(appCount: number): Promise<void> {
  const querySnapshot = await admin.firestore()
                        .collectionGroup('apps')
                        .orderBy('lastAuditAt', 'asc')
                        .limit(appCount)
                        .get();

  if (querySnapshot.size === 0) {
    return;
  }

  const [serviceWallet, walletError] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.log((walletError as ServiceError).message);
    return;
  }

  const apps = querySnapshot.docs.map(d => d.data() as TurtleApp);
  const audits = apps.map(app => auditApp(app, serviceWallet.wallet));

  await Promise.all(audits);
}

async function auditApp(app: TurtleApp, wallet: WalletBackend): Promise<AppAuditResult> {
  console.log(`starting audit for app: ${app.appId}`);

  const appTransactions   = wallet.getTransactions(undefined, undefined, false, app.subWallet);
  const allDeposits       = await getDeposits(app.appId);
  const allWithdrawals    = await getWithdrawals(app.appId);
  const summary           = '';

  // check for missing deposits
  const completedDeposits = allDeposits.filter(d => d.status === 'completed');
  const missingDeposits: Deposit[] = [];

  completedDeposits.forEach(deposit => {
    if (!appTransactions.find(tx => tx.hash === deposit.txHash)) {
      summary.concat(`completed deposit with hash [${deposit.txHash}] missing from wallet. \n`);
      missingDeposits.push(deposit);
    }
  });

  // check for missing withdrawal
  const successfulWithdrawals = allWithdrawals.filter(w => w.status === 'completed' && !w.failed);
  const missingWithdrawals: Withdrawal[] = [];

  successfulWithdrawals.forEach(withdrawal => {
    if (!appTransactions.find(tx => tx.hash === withdrawal.txHash)) {
      missingWithdrawals.push(withdrawal);
      summary.concat(`successful withdrawal with hash [${withdrawal.txHash}] missing from wallet. \n`);
    }
  });

  const depositTxs: Transaction[] = [];
  const withdrawalTxs: Transaction[] = [];

  appTransactions.forEach(tx => {
    // we only consider the first transfer in the tx
    const transferAmount = Array.from(tx.transfers).map(t => t[1])[0];

    if (transferAmount > 0) {
      depositTxs.push(tx);
    } else {
      withdrawalTxs.push(tx);
    }
  });

  // check for unprocessed deposits
  const unprocessedDepositHashes: string[] = [];

  depositTxs.forEach(tx => {
    if (!allDeposits.find(d => d.txHash === tx.hash)) {
      unprocessedDepositHashes.push(tx.hash);
      summary.concat(`wallet transaction with hash [${tx.hash}] not accounted for in deposits. \n`);
    }
  });

  // check for unprocessed deposits
  const unprocessedWithdrawalHashes: string[] = [];

  withdrawalTxs.forEach(tx => {
    if (!allWithdrawals.find(d => d.txHash === tx.hash)) {
      unprocessedWithdrawalHashes.push(tx.hash);
      summary.concat(`wallet transaction with hash [${tx.hash}] not accounted for in withdrawals. \n`);
    }
  });

  const [unlockedBalance, lockedBalance] = wallet.getBalance([app.subWallet]);
  const totalCredited = completedDeposits.map(d => d.amount).reduce((prev, next) => prev + next, 0);
  const totalDebited = successfulWithdrawals.map(w => w.amount + w.fee + w.serviceChargeAmount).reduce((prev, next) => prev + next, 0);

  const auditResult: AppAuditResult = {
    appId:                        app.appId,
    timestamp:                    Date.now(),
    passed:                       true,
    missingDepositsCount:         missingDeposits.length,
    missingWithdrawalsCount:      missingWithdrawals.length,
    unprocessedDepositsCount:     unprocessedDepositHashes.length,
    unprocessedWithdrawalsCount:  unprocessedWithdrawalHashes.length,
    walletLockedBalance:          lockedBalance,
    walletUnlockedBalance:        unlockedBalance,
    totalCredited:                totalCredited,
    totalDebited:                 totalDebited,
    appBalance:                   totalCredited - totalDebited
  }

  if (summary !== '') {
    auditResult.summary = summary;
  }

  if (missingDeposits.length > 0) {
    const missingHashes: string[] = [];

    missingDeposits.forEach(d => {
      if (d.txHash) {
        missingHashes.push(d.txHash);
      }
    });

    auditResult.missingDepositHashes = missingHashes;
    auditResult.passed = false;
  }

  if (missingWithdrawals.length > 0) {
    const missingHashes: string[] = [];

    missingWithdrawals.forEach(w => {
      if (w.txHash) {
        missingHashes.push(w.txHash);
      }
    });

    auditResult.missingWithdrawalHashes = missingHashes;
    auditResult.passed = false;
  }

  if (unprocessedDepositHashes.length > 0) {
    auditResult.uncountedDepositHashes = unprocessedDepositHashes;
    auditResult.passed = false;
  }

  if (unprocessedWithdrawalHashes.length > 0) {
    auditResult.uncountedWithdrawalHashes = unprocessedWithdrawalHashes;
    auditResult.passed = false;
  }

  console.log(`app ${app.appId} audit completed, passed: ${auditResult.passed}`);

  const appUpdate: TurtleAppUpdate = {
    lastAuditAt: Date.now(),
    lastAuditPassed: auditResult.passed
  }

  await admin.firestore().collection('appAudits').add(auditResult);
  await admin.firestore().doc(`apps/${app.appId}`).update(appUpdate);

  return auditResult;
}

async function getDeposits(appId: string): Promise<Deposit[]> {
  try {
    const querySnapshot = await admin.firestore()
                            .collection(`apps/${appId}/deposits`)
                            .get();

    return querySnapshot.docs.map(d => d.data() as Deposit);
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function getWithdrawals(appId: string): Promise<Withdrawal[]> {
  try {
    const querySnapshot = await admin.firestore()
                            .collection(`apps/${appId}/withdrawals`)
                            .get();

    return querySnapshot.docs.map(d => d.data() as Withdrawal);
  } catch (error) {
    console.log(error);
    return [];
  }
}
