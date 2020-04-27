import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as ServiceModule from './serviceModule';
import * as WalletManager from '../walletManager';
import * as AppsModule from './appsModule';
import { AppAuditResult, ServiceWallet } from '../types';
import { TurtleApp, Deposit, Withdrawal, TurtleAppUpdate } from '../../../shared/types';
import { ServiceError } from '../serviceError';
import { WalletBackend } from 'turtlecoin-wallet-backend';

exports.onAuditCreated = functions.firestore.document('/appAudits/{auditId}')
.onCreate(async (snapshot, context) => {

  const audit = snapshot.data() as AppAuditResult;

  if (!audit.passed) {
    const title = `Alert: app audit failed`;
    let message = `App with id ${audit.appId} audit failed. Audit id: ${audit.id} \n`

    if (audit.logs) {
      audit.logs.forEach(log => {
        message += `${log} \n`;
      });
    }

    await ServiceModule.sendAdminEmail(title, message);
  }
});

export async function runAppAudits(appCount: number, serviceWallet: ServiceWallet): Promise<void> {
  const snapshot1 = await admin.firestore()
                    .collection('apps')
                    .where('lastAuditPassed', '==', false)
                    .orderBy('lastAuditAt', 'asc')
                    .limit(appCount)
                    .get();

  const apps = snapshot1.docs.map(d => d.data() as TurtleApp);
  const remainder = appCount - apps.length;

  if (remainder > 0) {
    const snapshot2 = await admin.firestore()
                        .collection('apps')
                        .orderBy('lastAuditAt', 'asc')
                        .limit(remainder)
                        .get();

    const remainingApps = snapshot2.docs.map(d => d.data() as TurtleApp);

    remainingApps.forEach(app => {
      if (!apps.some(a => a.appId === app.appId)) {
        apps.push(app);
      }
    });
  }

  if (apps.length === 0) {
    return;
  }

  const auditsJobs = apps.map(app => auditApp(app, serviceWallet.instance.wallet));

  await Promise.all(auditsJobs);
}

export async function requestAppAudit(appId: string): Promise<void> {
  const [app, appErr] = await AppsModule.getApp(appId);

  if (!app) {
    console.log((appErr as ServiceError).message);
    return;
  }

  const timeSinceLastAudit = Date.now() - app.lastAuditAt;
  const minAuditTimeDelta = 1000 * 60 * 10; // TODO: move to service config

  if (timeSinceLastAudit < minAuditTimeDelta) {
    console.log(`not enough time as passed since last audit for app ${app.appId}, skipping audit.`);
    return;
  }

  const [serviceWallet, walletErr] = await WalletManager.getServiceWallet();

  if (!serviceWallet) {
    console.log((walletErr as ServiceError).message);
    return;
  }

  await auditApp(app, serviceWallet.instance.wallet);
}

export async function getAppAuditsInPeriod(since: number, to: number): Promise<AppAuditResult[]> {
  if (since > to) {
    return [];
  }

  const snapshot = await admin.firestore().collection('appAudits')
                    .where('timestamp', '>=', since)
                    .where('timestamp', '<=', to)
                    .orderBy('timestamp', 'desc')
                    .get();

  return snapshot.docs.map(d => d.data() as AppAuditResult);
}

async function auditApp(app: TurtleApp, wallet: WalletBackend): Promise<AppAuditResult> {
  console.log(`starting audit for app: ${app.appId}`);

  const appTransactions   = wallet.getTransactions(undefined, undefined, false, app.subWallet);
  const allDeposits       = await AppsModule.getDeposits(app.appId);
  const allWithdrawals    = await AppsModule.getWithdrawals(app.appId);
  const logs: string[]    = [];

  // check for missing deposits
  const successfulDeposits = allDeposits.filter(d => d.status === 'completed' && !d.cancelled);
  const missingDeposits: Deposit[] = [];

  successfulDeposits.forEach(deposit => {
    if (!appTransactions.find(tx => tx.hash === deposit.txHash)) {
      missingDeposits.push(deposit);
      logs.push(`completed deposit id [${deposit.id}] with hash [${deposit.txHash}] missing from wallet.`);
    }
  });

  // check for missing withdrawal
  const successfulWithdrawals = allWithdrawals.filter(w => w.status === 'completed' && !w.failed);
  const missingWithdrawals: Withdrawal[] = [];

  successfulWithdrawals.forEach(withdrawal => {
    if (!appTransactions.find(tx => tx.hash === withdrawal.txHash)) {
      missingWithdrawals.push(withdrawal);
      logs.push(`successful withdrawal id [${withdrawal.id}] with hash [${withdrawal.txHash}] missing from wallet.`);
    }
  });

  const [unlockedBalance, lockedBalance] = wallet.getBalance([app.subWallet]);

  const confirmedCredited = successfulDeposits
                            .map(d => d.amount)
                            .reduce((total, current) => total + current, 0);

  const confirmedDebited = successfulWithdrawals
                            .map(w => w.amount + w.fees.txFee + w.fees.nodeFee + w.fees.serviceFee)
                            .reduce((total, current) => total + current, 0);

  const appAccounts           = await AppsModule.getAppAccounts(app.appId);
  const appWalletTotalBalance = unlockedBalance + lockedBalance;
  const accountsTotalUnlocked = appAccounts
                                  .map(a => a.balanceUnlocked)
                                  .reduce((total, current) => total + current, 0);

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
    id:                     auditId,
    appId:                  app.appId,
    timestamp:              Date.now(),
    passed:                 auditPassed,
    walletLockedBalance:    lockedBalance,
    walletUnlockedBalance:  unlockedBalance,
    totalCredited:          confirmedCredited,
    totalDebited:           confirmedDebited,
    appBalance:             confirmedCredited - confirmedDebited
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
