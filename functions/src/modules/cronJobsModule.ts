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

exports.runAppAudits = functions.pubsub.schedule('every 6 hours').onRun(async (context) => {
  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
    return;
  }

  await AppModule.runAppAudits(10);
});

exports.maintenanceJobs = functions.pubsub.schedule('every 12 hours').onRun(async (context) => {
  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.error(`failed to get service wallet: ${(serviceError as ServiceError).message}`);
    return;
  }

  const jobs: Promise<any>[] = [];

  // TODO: re-add missing subwallets

  jobs.push(WithdrawalsModule.processLostWithdrawals(serviceWallet));

  await Promise.all(jobs);
});

exports.heartbeat = functions.pubsub.schedule('every 1 minutes').onRun(async (context) => {
  const latestSave = await WalletManager.getLatestSavedWallet(false);

  if (!latestSave) {
    console.log('no latest save wallet available, skipping heartbeat.');
    return;
  }

  const latestSaveCutoff = latestSave.timestamp + (1000 * 60 * 60);

  if (Date.now() > latestSaveCutoff) {
    console.log('no recent saved wallet available, skipping heartbeat.');
    return;
  }

  const walletSyncDelta = latestSave.networkHeight - latestSave.walletHeight;

  if (walletSyncDelta > 120) {
    console.log(`latest saved wallet sync delta too large [${walletSyncDelta}], skipping heartbeat.`);
    return;
  }

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
