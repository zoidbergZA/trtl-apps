import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as Constants from './constants';
import * as AppModule from './appModule';
import * as ServiceModule from './serviceModule';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as Analytics from './analyticsModule';
import * as WalletManager from './walletManager';
import * as WebhooksModule from './webhookModule';
import * as UsersModule from './usersModule';
import { api } from './requestHandlers';
import { Deposit, Withdrawal, ServiceCharge } from '../../shared/types';
import { ServiceError } from './serviceError';


// =============================================================================
//                              Initialization
// =============================================================================


const cors = require('cors')({ origin: true });
admin.initializeApp();

// Create "main" function to host all other top-level functions
const expressApp = express();
expressApp.use('/api', api);

try {
  const appInsightsApiKey = functions.config().azure.appinsights;

  if (appInsightsApiKey) {
    Analytics.initAppInsights(appInsightsApiKey);
  }
} catch (error) {
  // no app insights API key set
}


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

  const success = await AppModule.setAppState(owner, appId, active);

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

  const success = await AppModule.resetAppSecret(owner, appId);

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

export const getServiceStatus = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const [status, error] = await ServiceModule.getServiceStatus();

  if (!status) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return status;
});

export const rewindWallet = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const distance: number | undefined = data.distance;

  if (!distance) {
    throw new functions.https.HttpsError('invalid-argument', 'missing distance parameter');
  }

  const fetchResults = await Promise.all([
    WalletManager.getServiceWallet(false),
    WalletManager.getAppEngineToken()
  ]);

  const [serviceWallet, serviceError] = fetchResults[0];
  const [token, tokenError] = fetchResults[1];

  if (!serviceWallet) {
    throw new functions.https.HttpsError('internal', (serviceError as ServiceError).message);
  }

  if (!token) {
    throw new functions.https.HttpsError('internal', (tokenError as ServiceError).message);
  }

  const [wHeight, ,] = serviceWallet.wallet.getSyncStatus();
  const rewindHeight = wHeight - distance;

  console.log(`rewind wallet to height: ${rewindHeight}`);
  await serviceWallet.wallet.rewind(rewindHeight);

  const [saveTimestamp, saveError] = await WalletManager.saveMasterWallet(serviceWallet.wallet);
  const appEngineRestarted = await WalletManager.startAppEngineWallet(token, serviceWallet.serviceConfig);

  console.log(`app engine wallet successfully restarted? ${appEngineRestarted}`);

  if (!saveTimestamp) {
    throw new functions.https.HttpsError('internal', (saveError as ServiceError).message);
  }

  return { status: 'OK' };
});

export const getDepositHistory = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const depositId: string | undefined = data.depositId;

  if (!depositId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [history, error] = await DepositsModule.getDepositHistory(depositId);

  if (!history) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return history;
});

export const getWithdrawalHistory = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const withdrawalId: string | undefined = data.withdrawalId;

  if (!withdrawalId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [history, error] = await WithdrawalsModule.getWithdrawalHistory(withdrawalId);

  if (!history) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return history;
});

export const getServiceChargeAccounts = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const [accounts, error] = await ServiceModule.getServiceChargeAccounts();

  if (!accounts) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return accounts;
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


exports.onAccountWrite = functions.firestore.document(`/apps/{appId}/accounts/accountId`)
.onWrite(async (change, context) => {
  const newState = change.after.data();

  if (!newState) {
    return;
  }

  const historyRef  = `/apps/${context.params.appId}/accounts/${context.params.accountId}/accountHistory`;
  const accountData = newState as any;

  accountData.timestamp = Date.now();

  await admin.firestore().collection(historyRef).add(accountData);
});

exports.onDepositUpdated = functions.firestore.document(`/apps/{appId}/deposits/{depositId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Deposit;
  const newState  = change.after.data() as Deposit;

  await DepositsModule.processAccountDepositUpdate(oldState, newState);
});

exports.onDepositWrite = functions.firestore.document(`/apps/{appId}/deposits/{depositId}`)
.onWrite(async (change, context) => {
  const newState = change.after.data();

  if (!newState) {
    return;
  }

  const historyRef = `/apps/${context.params.appId}/deposits/${context.params.depositId}/depositHistory`;

  await admin.firestore().collection(historyRef).add(newState);
});

exports.onWithdrawalCreated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onCreate(async (snapshot, context) => {
  const state = snapshot.data() as Withdrawal;

  await WithdrawalsModule.processPendingWithdrawal(state);
});

exports.onWithdrawalUpdated = functions.firestore.document(`/apps/{appId}/withdrawals/{withdrawalId}`)
.onUpdate(async (change, context) => {
  const oldState  = change.before.data() as Withdrawal;
  const newState  = change.after.data() as Withdrawal;

  await WithdrawalsModule.processWithdrawalUpdate(oldState, newState);
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

exports.onServiceChargeUpdated = functions.firestore.document(`/apps/{appId}/serviceCharges/{chargeId}`)
.onUpdate(async (change, context) => {
  const charge = change.after.data() as ServiceCharge;

  if (charge.status === 'completed' && !charge.cancelled) {
    Analytics.trackMetric('successful service charge', charge.amount * 0.01);
  }
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

export const giveUserAdminRights = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    const adminSignature = request.get(Constants.serviceAdminRequestHeader);

    if (adminSignature !== functions.config().serviceadmin.password) {
      response.status(403).send('unauthorized request.');
      return;
    }

    const userId: string | undefined = request.query.uid;

    if (!userId) {
      response.status(400).send('bad request');
      return;
    }

    return ServiceModule.giveUserAdminRights(userId).then(succeeded => {
      response.status(200).send({ succeeded: succeeded });
    }).catch(error => {
      console.log(error);
      response.status(500).send({ error: error });
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

exports.warmupAppEngineWallet = functions.pubsub.schedule('every 2 hours').onRun(async (context) => {
  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);
    return;
  }

  const [token, tokenError] = await WalletManager.getAppEngineToken();

  if (!token) {
    console.log((tokenError as ServiceError).message);
    return;
  }

  await WalletManager.warmupAppEngineWallet(token, serviceConfig);
});

exports.maintenanceJobs = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
  const fetchResults = await Promise.all([
    WalletManager.getServiceWallet(false),
    WalletManager.getAppEngineToken()
  ]);

  const [serviceWallet, serviceError] = fetchResults[0];
  const [token, tokenError] = fetchResults[1];

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
    return;
  }

  if (!token) {
    console.error(`failed to get app engine token: ${(tokenError as ServiceError).message}`);
    return;
  }

  const jobs: Promise<any>[] = [];

  jobs.push(WalletManager.backupMasterWallet());
  jobs.push(AppModule.runAppAudits(10));
  jobs.push(WithdrawalsModule.processLostWithdrawals(serviceWallet));

  await Promise.all(jobs);

  const rewindDistance  = 2000;
  const [wHeight, ,]    = serviceWallet.wallet.getSyncStatus();
  const rewindHeight    = wHeight - rewindDistance;

  console.log(`rewind wallet to height: ${rewindHeight}`);
  await serviceWallet.wallet.rewind(rewindHeight);

  const [saveTimestamp, saveError] = await WalletManager.saveMasterWallet(serviceWallet.wallet);
  const appEngineRestarted = await WalletManager.startAppEngineWallet(token, serviceWallet.serviceConfig);

  if (saveTimestamp) {
    console.log(`wallet rewind to height ${rewindHeight} successfully saved at: ${saveTimestamp}`);
  } else {
    console.error((saveError as ServiceError).message);
  }

  console.log(`app engine wallet restart successful: ${appEngineRestarted}`);
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


// =============================================================================
//                              Utility functions
// =============================================================================


async function isAdminUserCheck(context: functions.https.CallableContext): Promise<boolean> {
  if (!context.auth) {
    return false;
  }

  try {
    const user    = await admin.auth().getUser(context.auth.uid);
    const claims  = user.customClaims as any;

    if (claims && !!claims.admin) {
      return true;
    }
  } catch (error) {
    console.log(error);
  }

  return false;
}
