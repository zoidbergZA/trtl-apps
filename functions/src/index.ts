import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as AppModule from './appModule';
import * as ServiceAdmin from './functions/serviceAdmin';
import * as ServiceModule from './serviceModule';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as Analytics from './analyticsModule';
import * as WalletManager from './walletManager';
import * as WebhooksModule from './webhookModule';
import { api } from './requestHandlers';
import { Deposit, Withdrawal, ServiceCharge, ServiceUser } from '../../shared/types';
import { ServiceError } from './serviceError';


export const serviceAdmin = ServiceAdmin;
export const appModule = AppModule;

// =============================================================================
//                              Initialization
// =============================================================================


admin.initializeApp();

// Create "main" function to host all other top-level functions
const expressApp = express();
expressApp.use('/api', api);

export const endpoints = functions.https.onRequest(expressApp);

try {
  const appInsightsApiKey = functions.config().azure.appinsights;

  if (appInsightsApiKey) {
    Analytics.initAppInsights(appInsightsApiKey);
  }
} catch (error) {
  // no app insights API key set
}


// =============================================================================
//                              Auth Triggers
// =============================================================================


exports.onServiceUserCreated = functions.auth.user().onCreate(async (user) => {
  await createServiceUser(user);
});

export async function createServiceUser(userRecord: admin.auth.UserRecord): Promise<void> {
  const id = userRecord.uid;

  let displayName = userRecord.displayName;

  if (!displayName) {
    if (userRecord.email) {
      displayName = userRecord.email;
    } else {
      displayName = 'Service user';
    }
  }

  const serviceUser: ServiceUser = {
    id: id,
    displayName: displayName
  }

  if (userRecord.email) {
    serviceUser.email = userRecord.email;
  }

  await admin.firestore().doc(`serviceUsers/${id}`).set(serviceUser);
}


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
  const [serviceWallet, error] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.log((error as ServiceError).message);
    return;
  }

  await WithdrawalsModule.processPendingWithdrawal(state, serviceWallet);
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
//                              Scheduled functions
// =============================================================================


const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 300,
  memory: "1GB"
}

exports.updateMasterWallet = functions.runWith(runtimeOpts).pubsub.schedule('every 5 minutes').onRun(async (context) => {
  await ServiceModule.updateMasterWallet();
});

exports.rewindServiceWallet = functions.pubsub.schedule('every 2 hours').onRun(async (context) => {
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

  const rewindDistance  = 480;
  const [wHeight, ,]    = serviceWallet.wallet.getSyncStatus();
  const rewindHeight    = wHeight - rewindDistance;

  console.log(`rewinding wallet to height: ${rewindHeight}`);
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

exports.maintenanceJobs = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet(false);

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
    return;
  }

  const jobs: Promise<any>[] = [];

  jobs.push(WalletManager.backupMasterWallet());
  // jobs.push(AppModule.runAppAudits(10));
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
