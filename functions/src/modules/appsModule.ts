import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as WalletManager from '../walletManager';
import * as ServiceModule from './serviceModule';
import * as Utils from '../../../shared/utils';
import { serviceChargesAccountId } from '../constants';
import { createIntegratedAddress } from 'turtlecoin-wallet-backend';
import { ServiceError } from '../serviceError';
import { SubWalletInfo, SubWalletInfoUpdate, TurtleApp, TurtleAppUpdate, Account, Deposit, Withdrawal } from '../../../shared/types';
import { generateRandomPaymentId, generateRandomSignatureSegement } from '../utils';
import { ServiceConfig } from '../types';

export const createApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appName: string = data.appName;
  const inviteCode: string | undefined = data.inviteCode;

  if (!owner || !appName) {
    return {
      error: true,
      message: 'Invalid parameters provided.'
    }
  }

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);

    return {
      error: true,
      message: 'Service currently unavailable.'
    }
  }


  // TODO: make the verified email requirement optional in serviceConfig
  // const userRecord = await admin.auth().getUser(owner);

  // if (!userRecord.emailVerified) {
  //   return {
  //     error: true,
  //     message: 'Verified email address required.'
  //   }
  // }

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

  const [app, appError] = await processCreateApp(owner, appName, serviceConfig, inviteCode);
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

export async function getAppAccounts(appId: string): Promise<Account[]> {
  const accountDocs = await admin.firestore().collection(`apps/${appId}/accounts`).get();

  return accountDocs.docs.map(d => d.data() as Account);
}

export async function getDeposits(appId: string): Promise<Deposit[]> {
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

export async function getWithdrawals(appId: string): Promise<Withdrawal[]> {
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

async function processCreateApp(
  owner: string,
  appName: string,
  serviceConfig: ServiceConfig,
  inviteCode?: string) : Promise<[TurtleApp | undefined, undefined | ServiceError]> {

  const validName = Utils.validateAppName(appName);

  if (!validName) {
    return [undefined, new ServiceError('app/invalid-app-name')];
  }

  const querySnapshot = await admin.firestore().collection(`apps`)
                          .where('owner', '==', owner)
                          .get();

  const ownerApps = querySnapshot.docs.map(d => d.data() as TurtleApp);

  if (ownerApps.length >= serviceConfig.userAppLimit) {
    return [undefined, new ServiceError('service/create-app-failed', 'Maximum apps limit reached.')];
  }

  if (ownerApps.some(a => a.name === appName)) {
    return [undefined, new ServiceError('app/invalid-app-name', 'An app with the same name already exists.')];
  }

  const [subWallet, walletError] = await getUnclaimedSubWallet();

  if (!subWallet) {
    return [undefined, walletError];
  }

  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet(false, true);

  if (!serviceWallet) {
    return [undefined, serviceError];
  }

  const walletAddresses = serviceWallet.instance.wallet.getAddresses();

  if (!walletAddresses.find(a => a === subWallet.address)) {
    return [undefined, new ServiceError('service/unknown-error', 'An error occured, please try again later.')];
  }

  let app: TurtleApp | undefined = undefined;

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const subWalletDocRef   = admin.firestore().doc(`wallets/master/subWallets/${subWallet.id}`);
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

      if (subWalletInfo.claimed || subWalletInfo.deleted) {
        throw new Error(`subWallet with address ${subWalletInfo.address} is invalid.`);
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
    return [undefined, new ServiceError('service/create-app-failed', 'An error occured, please try again later.')];
  }

  if (app === undefined) {
    console.log('unknown error while create app.');
    return [undefined, new ServiceError('service/create-app-failed')];
  } else {
    return [app, undefined];
  }
}

async function getUnclaimedSubWallet(): Promise<[SubWalletInfo | undefined, undefined | ServiceError]> {
  const unclaimedSubWallets = await WalletManager.getSubWalletInfos(true);

  const dateCutoff = Date.now() - (1000 * 60 * 60 * 24);
  const candidates = unclaimedSubWallets.filter(w => w.createdAt <= dateCutoff && !w.deleted);


  if (candidates.length === 0) {
    return [undefined, new ServiceError('service/no-unclaimed-subwallets', 'No unclaimed sub-wallets available, please try again later.')];
  }

  const selectedSubWallet = candidates[Math.floor(Math.random() * candidates.length)];

  return [selectedSubWallet, undefined];
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

function generateApiKey(): string {
  return crypto.randomBytes(64).toString('hex');
}
