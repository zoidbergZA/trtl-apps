import * as functions from 'firebase-functions';
import * as ServiceModule from './serviceModule';
import * as AppModule from './appsModule';
import * as WebhooksModule from './webhookModule';
import * as WalletManager from '../walletManager';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import { ServiceError } from '../serviceError';

const runtimeOpts: functions.RuntimeOptions = {
  timeoutSeconds: 540,
  memory: "1GB"
}

exports.updateMasterWallet = functions.runWith(runtimeOpts).pubsub.schedule('every 30 minutes').onRun(async (context) => {
  await ServiceModule.updateMasterWallet();
});

exports.updateWalletCheckpoints = functions.pubsub.schedule('every 30 minutes').onRun(async (context) => {
  await WalletManager.updateWalletCheckpoints();
});

// exports.rewindServiceWallet = functions.pubsub.schedule('every 2 hours').onRun(async (context) => {
//   const fetchResults = await Promise.all([
//     WalletManager.getServiceWallet(false),
//     WalletManager.getAppEngineToken()
//   ]);

//   const [serviceWallet, serviceError] = fetchResults[0];
//   const [token, tokenError] = fetchResults[1];

//   if (!serviceWallet) {
//     console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
//     return;
//   }

//   if (!token) {
//     console.error(`failed to get app engine token: ${(tokenError as ServiceError).message}`);
//     return;
//   }

//   const rewindDistance  = 480;
//   const [wHeight, ,]    = serviceWallet.wallet.getSyncStatus();
//   const rewindHeight    = wHeight - rewindDistance;

//   console.log(`rewinding wallet to height: ${rewindHeight}`);
//   await serviceWallet.wallet.rewind(rewindHeight);

//   const [saveTimestamp, saveError] = await WalletManager.saveWallet(serviceWallet.wallet, true);
//   const appEngineRestarted = await WalletManager.startAppEngineWallet(token, serviceWallet.serviceConfig);

//   if (saveTimestamp) {
//     console.log(`wallet rewind to height ${rewindHeight} successfully saved at: ${saveTimestamp}`);
//   } else {
//     console.error((saveError as ServiceError).message);
//   }

//   console.log(`app engine wallet restart successful: ${appEngineRestarted}`);
// });

exports.runAppAudits = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
    return;
  }

  await AppModule.runAppAudits(10);
});

exports.maintenanceJobs = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet(false);

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
    return;
  }

  const jobs: Promise<any>[] = [];

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
