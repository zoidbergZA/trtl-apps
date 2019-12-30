import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as AppModule from './appModule';
import * as ServiceModule from './serviceModule';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as WalletManager from './walletManager';
import * as WebhooksModule from './webhookModule';
import * as UsersModule from './usersModule';
import * as Constants from './constants';
import { api } from './requestHandlers';
import { Deposit, Withdrawal, TurtleApp } from '../../shared/types';
import { ServiceError } from './serviceError';


// =============================================================================
//                              Initialization
// =============================================================================


const cors = require('cors')({ origin: true });
admin.initializeApp();

// Create "main" function to host all other top-level functions
const expressApp = express();
expressApp.use('/api', api);


// =============================================================================
//                              Callable functions
// =============================================================================


export const createApp = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called while authenticated.');
  }

  const owner = context.auth.uid;
  const appName: string = data.appName;

  if (!owner || !appName) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [app, appError] = await AppModule.createApp(owner, appName);
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

  const [newWebhook, error] = await AppModule.setAppWebhook(owner, appId, webhook);
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


// =============================================================================
//                              Auth Triggers
// =============================================================================


exports.onServiceUserCreated = functions.auth.user().onCreate(async (user) => {
  await UsersModule.createServiceUser(user);
});


// =============================================================================
//                              Firestore Triggers
// =============================================================================


exports.onDepositUpdated = functions.firestore.document(`/apps/{appId}/deposits/{depositId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Deposit;
  const newState  = change.after.data() as Deposit;

  await DepositsModule.processAccountDepositUpdate(oldState, newState);
  return null;
});

exports.onWithdrawalUpdated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Withdrawal;
  const newState  = change.after.data() as Withdrawal;

  await WithdrawalsModule.processWithdrawalUpdate(oldState, newState);
  return null;
});


// =============================================================================
//                              HTTP Triggers
// =============================================================================


export const endpoints = functions.https.onRequest(expressApp);

export const bootstrap = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    const reqMasterPassword     = request.query.masterpass;
    const configMasterPassword  = functions.config().serviceadmin.password;

    if (reqMasterPassword !== configMasterPassword) {
      response.status(401).send('invalid master password!');
      return;
    }

    return ServiceModule.boostrapService().then(mnemonicSeed => {
      if (mnemonicSeed) {
        response.status(200).send({
          error: false,
          mnemonicSeed: mnemonicSeed
        });
      } else {
        response.status(405).send('error bootstrapping service');
      }
    }).catch(error => {
      response.status(405).send(error);
    });
  });
});

// // ******   FOR TESTING WEBHOOK   *****
// // can be commented out in production
// export const webhookTest = functions.https.onRequest((request, response) => {
//     console.log(JSON.stringify(request.body));
//     response.status(200).send('OK');
// });

export const rescanTest = functions.https.onRequest(async (request, response) => {
  const adminSignature = request.get(Constants.serviceAdminRequestHeader);

  if (!adminSignature !== functions.config().serviceadmin.password) {
    response.status(403).send('bad request');
    return;
  }

  const rescanHeight: number | undefined = Number(request.query.height);

  console.log(`rescan from height: ${rescanHeight}`);

  if (!rescanHeight) {
    response.status(400).send('bad request');
    return;
  }

  const [serviceWallet, error] = await WalletManager.getServiceWallet(false);

  if (!serviceWallet) {
    response.status(500).send((error as ServiceError).message);
    return;
  }

  await serviceWallet.wallet.rewind(rescanHeight);

  const [saveTimestamp, saveError] = await WalletManager.saveMasterWallet(serviceWallet.wallet);

  if (!saveTimestamp) {
    response.status(500).send((saveError as ServiceError).message);
    return;
  }

  response.status(200).send(`OK! :: rewind saved at ${saveTimestamp}`);
});

export const getAppTxsTest = functions.https.onRequest(async (request, response) => {
  const adminSignature = request.get(Constants.serviceAdminRequestHeader);

  if (!adminSignature !== functions.config().serviceadmin.password) {
    response.status(403).send('bad request');
    return;
  }

  const appId: string | undefined = request.query.appId;

  if (!appId) {
    response.status(400).send('bad request');
    return;
  }

  const docSnapshot = await admin.firestore().doc(`apps/${appId}`).get();

  if (!docSnapshot.exists) {
    response.status(404).send('app not found');
    return;
  }

  const turtleApp = docSnapshot.data() as TurtleApp;

  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    response.status(500).send((error as ServiceError).message);
    return;
  }

  const transactions = serviceWallet.wallet.getTransactions(undefined, undefined, true, turtleApp.subWallet);

  response.status(200).send(transactions);
});


// =============================================================================
//                              Scheduled functions
// =============================================================================


const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 300,
  memory: "1GB"
}

exports.updateMasterWallet = functions.runWith(runtimeOpts).pubsub.schedule('every 5 minutes').onRun(async (context) => {
  await ServiceModule.updateMasterWallet();
});

exports.backupMasterWallet = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  await WalletManager.backupMasterWallet();
});

exports.heartbeat = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  await ServiceModule.updateServiceNodes();
  await ServiceModule.checkNodeSwap();

  const updateDeposits    = DepositsModule.updateDeposits();
  const updateWithdrawals = WithdrawalsModule.updateWithdrawals();
  const retryCallbacks    = WebhooksModule.retryCallbacks();

  return Promise.all([updateDeposits, updateWithdrawals, retryCallbacks]).catch(error => {
    console.error(error);
  });
});
