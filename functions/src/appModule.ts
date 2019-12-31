import { ServiceError } from './serviceError';
import { SubWalletInfo, SubWalletInfoUpdate, TurtleApp, TurtleAppUpdate, DepositStatus, Deposit, Withdrawal } from '../../shared/types';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as ServiceModule from './serviceModule';
import * as WalletManager from './walletManager';
import * as Utils from '../../shared/utils';
import { AppAuditResult } from './types';
import { WalletBackend } from 'turtlecoin-wallet-backend';

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
        owner:          owner,
        appId:          appId,
        name:           appName,
        appSecret:      appSecret,
        subWallet:      subWalletInfo.address,
        publicKey:      subWalletInfo.publicSpendKey,
        createdAt:      timestamp,
        disabled:       false,
        lastAuditAt:      0,
        lastAuditPassed:  true
      }

      const subWalletInfoUpdate: SubWalletInfoUpdate = {
        claimed: true,
        appId: appId
      }

      txn.create(appDocRef, app);
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

export async function runAppAudits(): Promise<void> {
  const querySnapshot = await admin.firestore()
                        .collectionGroup('apps')
                        .orderBy('lastAuditAt', 'asc')
                        .limit(3)
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
  let auditSucceeded      = true;

  // check for missing deposits
  const completedDeposits = await getDepositsWithStatus(app.appId, 'completed');
  const missingDeposits: Deposit[] = [];

  completedDeposits.forEach(deposit => {
    if (!appTransactions.find(tx => tx.hash === deposit.txHash)) {
      missingDeposits.push(deposit);
    }
  });

  if (missingDeposits.length > 0) {
    console.error(`app ${app.appId} has ${missingDeposits.length} missing deposits!`);
    auditSucceeded = false;
  }

  // check for missing withdrawal
  const successfulWithdrawals = await getSuccessfulWithdrawals(app.appId);
  const missingWithdrawals: Withdrawal[] = [];

  successfulWithdrawals.forEach(withdrawal => {
    if (!appTransactions.find(tx => tx.hash === withdrawal.txHash)) {
      missingWithdrawals.push(withdrawal);
    }
  });

  if (missingWithdrawals.length > 0) {
    console.error(`app ${app.appId} has ${missingWithdrawals.length} missing withdrawals!`);
    auditSucceeded = false;
  }

  const auditResult: AppAuditResult = {
    appId: app.appId,
    timestamp: Date.now(),
    passed: auditSucceeded,
    missingDepositsCount: missingDeposits.length,
    missingWithdrawalsCount: missingWithdrawals.length
  }

  if (missingDeposits.length > 0) {
    const missingHashes: string[] = [];

    missingDeposits.forEach(d => {
      if (d.txHash) {
        missingHashes.push(d.txHash);
      }
    });

    auditResult.missingDepositHashes = missingHashes;
  }

  if (missingWithdrawals.length > 0) {
    const missingHashes: string[] = [];

    missingWithdrawals.forEach(w => {
      if (w.txHash) {
        missingHashes.push(w.txHash);
      }
    });

    auditResult.missingWithdrawalHashes = missingHashes;
  }

  console.log(`app ${app.appId} audit completed, passed: ${auditResult.passed}`);

  const appUpdate: TurtleAppUpdate = {
    lastAuditAt: Date.now(),
    lastAuditPassed: auditResult.passed
  }

  await admin.firestore().doc(`apps/${app.appId}`).update(appUpdate);

  return auditResult;
}

async function getDepositsWithStatus(appId: string, status: DepositStatus): Promise<Deposit[]> {
  try {
    const querySnapshot = await admin.firestore()
                            .collection(`apps/${appId}/deposits`)
                            .where('status', '==', status)
                            .get();

    return querySnapshot.docs.map(d => d.data() as Deposit);
  } catch (error) {
    console.log(error);
    return [];
  }
}

async function getSuccessfulWithdrawals(appId: string): Promise<Withdrawal[]> {
  try {
    const querySnapshot = await admin.firestore()
                            .collection(`apps/${appId}/withdrawals`)
                            .where('status', '==', 'completed')
                            .where('failed', '==', false)
                            .get();

    return querySnapshot.docs.map(d => d.data() as Withdrawal);
  } catch (error) {
    console.log(error);
    return [];
  }
}
