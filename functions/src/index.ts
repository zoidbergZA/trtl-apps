import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as Constants from './constants';
import * as AppModule from './appModule';
import * as ServiceModule from './serviceModule';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as WalletManager from './walletManager';
import * as WebhooksModule from './webhookModule';
import * as UsersModule from './usersModule';
import { api } from './requestHandlers';
import { Deposit, Withdrawal } from '../../shared/types';
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

  const [app, appError] = await AppModule.createApp(owner, appName, inviteCode);
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

exports.onWithdrawalCreated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onCreate(async (snapshot, context) => {
  const state = snapshot.data() as Withdrawal;

  await WithdrawalsModule.processPendingWithdrawal(state);
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
    const adminSignature = request.get(Constants.serviceAdminRequestHeader);

    if (adminSignature !== functions.config().serviceadmin.password) {
      response.status(403).send('unauthorized request.');
      return;
    }

    return ServiceModule.boostrapService().then(result => {
      const mnemonicSeed = result[0];
      const serviceError = result[1];

      if (mnemonicSeed) {
        response.status(200).send({
          error: false,
          mnemonicSeed: mnemonicSeed
        });
      } else {
        response.status(405).send((serviceError as ServiceError).message);
      }
    }).catch(error => {
      response.status(405).send(error);
    });
  });
});

export const createInvitationsBatch = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    const adminSignature = request.get(Constants.serviceAdminRequestHeader);

    if (adminSignature !== functions.config().serviceadmin.password) {
      response.status(403).send('unauthorized request.');
      return;
    }

    return ServiceModule.createInvitationsBatch(10).then(result => {
      const invitesCount = result[0];
      const serviceError = result[1];

      if (invitesCount) {
        response.status(200).send(`created ${invitesCount} new invitations.`);
      } else {
        response.status(500).send(serviceError as ServiceError);
      }
    }).catch(error => {
      console.log(error);
      response.status(500).send(new ServiceError('service/unknown-error'));
    });
  });
});

// // ******   FOR TESTING WEBHOOK   *****
// // can be commented out in production
// export const webhookTest = functions.https.onRequest((request, response) => {
//     console.log(JSON.stringify(request.body));
//     response.status(200).send('OK');
// });


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

exports.dailyJobs = functions.pubsub.schedule('every 24 hours').onRun(async (context) => {
  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError).message}`);
    return;
  }

  const jobs: Promise<any>[] = [];

  jobs.push(WalletManager.backupMasterWallet());
  jobs.push(AppModule.runAppAudits(10));
  jobs.push(WithdrawalsModule.processLostWithdrawals(serviceWallet));

  await Promise.all(jobs);
});

exports.heartbeat = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  await ServiceModule.updateServiceNodes();
  await ServiceModule.checkNodeSwap();

  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError).message}`);
    return;
  }

  const updateDeposits    = DepositsModule.updateDeposits(serviceWallet);
  const updateWithdrawals = WithdrawalsModule.updateWithdrawals(serviceWallet);

  await Promise.all([updateDeposits, updateWithdrawals]).catch(e => {
    console.error(e);
  });

  const retryCallbacks = WebhooksModule.retryCallbacks();
  const processCharges = ServiceModule.processServiceCharges();

  await Promise.all([retryCallbacks, processCharges]).catch(e => {
    console.error(e);
  });
});
