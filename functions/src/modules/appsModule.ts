import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as WalletManager from '../walletManager';
import * as ServiceModule from './serviceModule';
import * as Utils from '../../../shared/utils';
import { serviceChargesAccountId } from '../constants';
import { createIntegratedAddress, WalletBackend } from 'turtlecoin-wallet-backend';
import { ServiceError } from '../serviceError';
import { SubWalletInfo, SubWalletInfoUpdate, TurtleApp, TurtleAppUpdate, Account, Deposit, Withdrawal } from '../../../shared/types';
import { generateRandomPaymentId, generateRandomSignatureSegement } from '../utils';
import { AppAuditResult } from '../types';

export const createApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appName: string = data.appName;
  const inviteCode: string | undefined = data.inviteCode;

  if (!owner || !appName) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);

    return {
      error: true,
      message: 'Service currently unavailable.'
    }
  }

  if (serviceConfig.inviteOnly) {
    if (!inviteCode) {
      return {
        error: true,
        message: 'Invitation code required.'
      }
    }

    const isValidCode = await ServiceModule.validateInviteCode(inviteCode);

    if (!isValidCode) {
      return {
        error: true,
        message: 'Invalid invitation code.'
      }
    }
  }

  const [app, appError] = await processCreateApp(owner, appName, inviteCode);
  const result: any = {};

  if (appError) {
    result.error = true;
    result.message = appError.message;
  } else if (app) {
    result.error = false;
    result.appId = app.appId;
  }

  return result;
});

exports.onAuditCreated = functions.firestore.document('/appAudits/{auditId}')
.onCreate(async (snapshot, context) => {

  const audit = snapshot.data() as AppAuditResult;

  if (!audit.passed) {
    const title = `Alert: app audit failed`;
    let message = `App with id ${audit.appId} audit failed. Audit id: ${audit.id} \n`

    audit.logs?.forEach(log => {
      message += `${log} \n`;
    });

    await ServiceModule.sendAdminEmail(title, message);
  }
});

export async function getApp(appId: string): Promise<[TurtleApp | undefined, undefined | ServiceError]> {
  const appDoc = await admin.firestore().doc(`apps/${appId}`).get();

  if (!appDoc.exists) {
    return [undefined, new ServiceError('app/app-not-found')];
  }

  return [appDoc.data() as TurtleApp, undefined];
}

export const setAppState = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appId: string | undefined = data.appId;
  const active: boolean = !!data.active;

  if (!appId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const success = await processSetAppState(owner, appId, active);

  if (!success) {
    throw new functions.https.HttpsError('unknown', 'An Unknown error occured.');
  }

  return { success: true };
});

export const resetAppSecret = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appId: string = data.appId;

  if (!appId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const success = await processResetAppSecret(owner, appId);

  if (!success) {
    throw new functions.https.HttpsError('unknown', 'An Unknown error occured.');
  }

  return { success: true };
});

export const setAppWebhook = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appId: string = data.appId;
  const webhook: string | undefined = data.webhook;

  if (!appId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [newWebhook, error] = await processSetAppWebhook(owner, appId, webhook);
  const result: any = {};

  if (error) {
    result.error = true;
    result.message = error.message;
  } else if (newWebhook) {
    result.error = false;
    result.webhook = newWebhook;
  }

  return result;
});

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

  const apps        = querySnapshot.docs.map(d => d.data() as TurtleApp);
  const auditsJobs  = apps.map(app => auditApp(app, serviceWallet.wallet));

  await Promise.all(auditsJobs);
}

export async function requestAppAudit(appId: string): Promise<void> {
  const [app, appErr] = await getApp(appId);

  if (!app) {
    console.log((appErr as ServiceError).message);
    return;
  }

  const timeSinceLastAudit = Date.now() - app.lastAuditAt;
  const minAuditTimeDelta = 1000 * 60 * 10; // 10 minutes

  if (timeSinceLastAudit < minAuditTimeDelta) {
    console.log(`not enough time as passed since last audit for app ${app.appId}, skipping audit.`);
    return;
  }

  const [serviceWallet, walletErr] = await WalletManager.getServiceWallet(true);

  if (!serviceWallet) {
    console.log((walletErr as ServiceError).message);
    return;
  }

  await auditApp(app, serviceWallet.wallet);
}

async function processCreateApp(
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
      const appSecret         = generateApiKey();
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

async function processSetAppState(owner: string, appId: string, active: boolean): Promise<boolean> {
  const [app] = await getApp(appId);

  if (!app) {
    return false;
  }

  if (owner !== app.owner) {
    return false;
  }

  const appUpdate: TurtleAppUpdate = {
    disabled: !active
  }

  try {
    await admin.firestore().doc(`apps/${appId}`).update(appUpdate);
    return true;
  } catch {
    return false;
  }
}

async function processResetAppSecret(owner: string, appId: string): Promise<boolean> {
  const [app] = await getApp(appId);

  if (!app) {
    return false;
  }

  if (owner !== app.owner) {
    return false;
  }

  const appUpdate: TurtleAppUpdate = {
    appSecret: generateApiKey()
  }

  try {
    await admin.firestore().doc(`apps/${appId}`).update(appUpdate);
    return true;
  } catch {
    return false;
  }
}

async function processSetAppWebhook(
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

async function getAppAccounts(appId: string): Promise<Account[]> {
  const accountDocs = await admin.firestore().collection(`apps/${appId}/accounts`).get();

  return accountDocs.docs.map(d => d.data() as Account);
}

async function auditApp(app: TurtleApp, wallet: WalletBackend): Promise<AppAuditResult> {
  console.log(`starting audit for app: ${app.appId}`);

  const appTransactions   = wallet.getTransactions(undefined, undefined, false, app.subWallet);
  const allDeposits       = await getDeposits(app.appId);
  const allWithdrawals    = await getWithdrawals(app.appId);
  const logs: string[]    = [];

  // check for missing deposits
  const completedDeposits = allDeposits.filter(d => d.status === 'completed');
  const missingDeposits: Deposit[] = [];

  completedDeposits.forEach(deposit => {
    if (!appTransactions.find(tx => tx.hash === deposit.txHash)) {
      missingDeposits.push(deposit);
      logs.push(`completed deposit with hash [${deposit.txHash}] missing from wallet.`);
    }
  });

  // check for missing withdrawal
  const successfulWithdrawals = allWithdrawals.filter(w => w.status === 'completed' && !w.failed);
  const missingWithdrawals: Withdrawal[] = [];

  successfulWithdrawals.forEach(withdrawal => {
    if (!appTransactions.find(tx => tx.hash === withdrawal.txHash)) {
      missingWithdrawals.push(withdrawal);
      logs.push(`successful withdrawal with hash [${withdrawal.txHash}] missing from wallet.`);
    }
  });

  const [unlockedBalance, lockedBalance] = wallet.getBalance([app.subWallet]);

  const confirmedCredited = completedDeposits
                            .map(d => d.amount)
                            .reduce((total, current) => total + current);

  const confirmedDebited = successfulWithdrawals
                            .map(w => w.amount + w.fees.txFee + w.fees.nodeFee + w.fees.serviceFee)
                            .reduce((total, current) => total + current);

  const appAccounts           = await getAppAccounts(app.appId);
  const appWalletTotalBalance = unlockedBalance + lockedBalance;
  const accountsTotalUnlocked = appAccounts
                                  .map(a => a.balanceUnlocked)
                                  .reduce((total, current) => total + current);

  const auditRef  = admin.firestore().collection('appAudits').doc();
  const auditId   = auditRef.id;
  let auditPassed = true;

  if (appWalletTotalBalance < accountsTotalUnlocked) {
    auditPassed = false;
    logs.push(`the sum of app account balances is more than the sub-wallet total balance!`);

    const haltMessage = `App with id ${app.appId} has more total account unlocked balances than the
      total sub-wallet balance. Service halted! App audit id: ${auditId}`;

    await ServiceModule.haltService(haltMessage);
  }


  const auditResult: AppAuditResult = {
    id:                           auditId,
    appId:                        app.appId,
    timestamp:                    Date.now(),
    passed:                       auditPassed,
    walletLockedBalance:          lockedBalance,
    walletUnlockedBalance:        unlockedBalance,
    totalCredited:                confirmedCredited,
    totalDebited:                 confirmedDebited,
    appBalance:                   confirmedCredited - confirmedDebited
  }

  if (logs.length > 0) {
    auditResult.logs = logs;
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

  console.log(`app ${app.appId} completed, passed: ${auditResult.passed}`);

  const appUpdate: TurtleAppUpdate = {
    lastAuditAt: Date.now(),
    lastAuditPassed: auditResult.passed
  }

  await auditRef.set(auditResult);
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

function generateApiKey(): string {
  return crypto.randomBytes(64).toString('hex');
}
