import axios from 'axios';
import * as functions from 'firebase-functions';
import * as ServiceModule from './modules/serviceModule';
import * as AppsModule from './modules/appsModule';
import * as Constants from './constants';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { WalletBackend, IDaemon, Daemon, WalletError } from 'turtlecoin-wallet-backend';
import { sleep } from './utils';
import { ServiceError } from './serviceError';
import { ServiceWallet, WalletInfo, ServiceConfig, WalletInfoUpdate, WalletSyncInfo,
  StartWalletRequest, PrepareTransactionRequest, SavedWallet, SavedWalletUpdate } from './types';
import { SubWalletInfo, WalletStatus } from '../../shared/types';
import { SendTransactionResult } from 'turtlecoin-wallet-backend/dist/lib/Types';
import { google } from 'googleapis';
import { Storage } from '@google-cloud/storage';

let masterWallet: WalletBackend | undefined;
let masterWalletStartedAt: number | undefined;
let masterWalletLastSaveAt: number | undefined; // TODO: remove

let loadedFromSave: SavedWallet | undefined;

export async function createMasterWallet(serviceConfig: ServiceConfig): Promise<[string | undefined, undefined | ServiceError]> {
  console.log('creating new master wallet...');

  const walletDoc: WalletInfo = {
    location:         Constants.defaultWalletLocation,
    backupsDirectory: Constants.defaultWalletBackupsDirectory,
    lastSaveAt:       Date.now(),
    lastBackupAt:     0
  }

  try {
    await admin.firestore().doc('wallets/master').create(walletDoc);
    console.log(`master wallet info doc successfully created...`);
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('service/master-wallet-info', `Error creating WalletInfo: ${error}`)];
  }

  const daemon: IDaemon = new Daemon(serviceConfig.daemonHost, serviceConfig.daemonPort);

  try {

    masterWallet = WalletBackend.createWallet(daemon);
    await masterWallet.start();

    // give the new wallet time to sync
    await sleep(20 * 1000);

    console.log(`successfully created new WalletBackend!`);
  } catch (error) {
    console.error(`error creating new WalletBackend: ${error}`);
    return [undefined, new ServiceError('service/unknown-error', error)];
  }

  const [saveDate, saveError] = await saveWallet(true);

  if (!saveDate) {
    console.error('error saving master wallet!');
    return [undefined, saveError];
  }

  const [seed, seedError] = masterWallet.getMnemonicSeed();

  if (!seed) {
    return [undefined, new ServiceError('service/master-wallet-info', (seedError as WalletError).toString())];
  }

  return [seed, undefined];
}

export async function getServiceWallet(
  waitForSync: boolean = true): Promise<[ServiceWallet | undefined, undefined | ServiceError]> {

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    return [undefined, configError];
  }

  if (serviceConfig.serviceHalted) {
    return [undefined, new ServiceError('service/service-halted')];
  }

  const [wallet, openError] = await getMasterWallet(serviceConfig);

  if (!wallet) {
    return [undefined, openError];
  }

  const serviceWallet: ServiceWallet = {
    wallet: wallet,
    serviceConfig: serviceConfig
  }

  if (!waitForSync) {
    return [serviceWallet, undefined];
  }

  const syncStart     = Date.now();
  const synced        = await waitForWalletSync(wallet, serviceConfig.waitForSyncTimeout);
  const syncEnd       = Date.now();
  const syncSeconds   = (syncEnd - syncStart) / 1000;

  console.log(`sync successful? [${synced}], sync time: ${syncSeconds}(s)`);

  if (!synced) {
    // stoping current wallet instance
    if (masterWallet) {
      await masterWallet.stop();
      masterWallet.removeAllListeners();
      masterWallet = undefined;
    }

    return [undefined, new ServiceError('service/master-wallet-sync-failed')];
  }

  return [serviceWallet, undefined];
}

async function getMasterWallet(
  serviceConfig: ServiceConfig,
  forceRestart = false,
  rewindDistanceOnStart = 40): Promise<[WalletBackend | undefined, undefined | ServiceError]> {

  const walletInfo = await getMasterWalletInfo();

  if(!walletInfo) {
    return [undefined, new ServiceError('service/master-wallet-info')];
  }

  if (masterWallet) {

    const daemonInfo = masterWallet.getDaemonConnectionInfo();
    let restartNeeded = false;

    if (daemonInfo.host !== serviceConfig.daemonHost || daemonInfo.port !== serviceConfig.daemonPort) {
      console.log('daemon info changed, restart needed.');
      restartNeeded = true;
    }

    if (masterWalletStartedAt && Date.now() >= (masterWalletStartedAt + (1000 * 60 * 10))) {
      // 10 minutes is the max lifetime of a master wallet instance
      console.log('max wallet instance time exceeded, restart needed.');
      restartNeeded = true;
    }

    if (masterWalletLastSaveAt !== walletInfo.lastSaveAt)
    {
      console.log('wallet saved since last start, restart needed.');
      restartNeeded = true;
    }

    if (restartNeeded || forceRestart) {
      console.log(`starting new wallet instance...`);

      // load and swap to a new instance of the master wallet
      const encryptedString = await getMasterWalletString();

      if (!encryptedString) {
        return [undefined, new ServiceError('service/master-wallet-file')];
      }

      const [newWallet, error] = await startWalletFromString(encryptedString, serviceConfig.daemonHost, serviceConfig.daemonPort);

      if (!newWallet) {
        return [undefined, error];
      }

      if (rewindDistanceOnStart > 0) {
        await rewindWallet(newWallet, rewindDistanceOnStart);
      }

      const oldWalletInstance = masterWallet;

      masterWallet = newWallet;
      masterWalletLastSaveAt = walletInfo.lastSaveAt;
      console.log(`new master wallet instance started at: ${masterWalletStartedAt}`);

      await oldWalletInstance.stop();
      oldWalletInstance.removeAllListeners();

      return [masterWallet, undefined];
    } else {
      return [masterWallet, undefined];
    }

  } else {
    const encryptedString = await getMasterWalletString();

    if (!encryptedString) {
      console.error('no master wallet file data.');
      return [undefined, new ServiceError('service/master-wallet-file')];
    }

    const [wallet, error] = await startWalletFromString(encryptedString, serviceConfig.daemonHost, serviceConfig.daemonPort);

    if (wallet) {
      console.log(`new master wallet instance started at: ${masterWalletStartedAt}`);

      if (rewindDistanceOnStart > 0) {
        await rewindWallet(wallet, rewindDistanceOnStart);
      }

      masterWallet = wallet;
      masterWalletLastSaveAt = walletInfo.lastSaveAt;
    }

    return [wallet, error];
  }
}

export async function prepareAccountTransaction(
  serviceConfig: ServiceConfig,
  appWallet: string,
  accountId: string,
  sendAddress: string,
  paymentId: string,
  amount: number): Promise<[SendTransactionResult | undefined, undefined | ServiceError]> {

  const [token, jwtError] = await getAppEngineToken();

  if (!token) {
    console.log(`wallet jwt token error: ${(jwtError as ServiceError).message}`);
    return [undefined, jwtError];
  }

  const walletReady = await warmupAppEngineWallet(token, serviceConfig);

  console.log(`wallet ready? ${walletReady}`);

  if (!walletReady) {
    return [undefined, new ServiceError('service/unknown-error', 'cloud wallet not ready.')];
  }

  const txRequest: PrepareTransactionRequest = {
    subWallet: appWallet,
    senderId: accountId,
    sendAddress: sendAddress,
    amount: amount,
    paymentId: paymentId
  }

  const appEngineApi = getAppEngineApiBase();
  const endpoint = `${appEngineApi}/prepare_transaction`;

  const reqConfig = {
    headers: { Authorization: "Bearer " + token }
  }

  try {
    const response = await axios.post(endpoint, txRequest, reqConfig);
    const sendResult = response.data as SendTransactionResult;

    console.log(sendResult);
    return [sendResult, undefined];
  } catch (error) {
    return [undefined, error.response.data];
  }
}

export async function sendPreparedTransaction(
  preparedTxHash: string,
  serviceConfig: ServiceConfig): Promise<[SendTransactionResult | undefined, undefined | ServiceError]> {

  const [token, jwtError] = await getAppEngineToken();

  if (!token) {
    console.log(`wallet jwt token error: ${(jwtError as ServiceError).message}`);
    return [undefined, jwtError];
  }

  const walletReady = await warmupAppEngineWallet(token, serviceConfig);

  if (!walletReady) {
    return [undefined, new ServiceError('service/unknown-error', 'cloud wallet not ready.')];
  }

  const body: any = {
    preparedTxHash: preparedTxHash
  }

  const appEngineApi = getAppEngineApiBase();
  const endpoint = `${appEngineApi}/send`;

  const reqConfig = {
    headers: { Authorization: "Bearer " + token }
  }

  try {
    const response = await axios.post(endpoint, body, reqConfig);
    const sendResult = response.data as SendTransactionResult;

    return [sendResult, undefined];
  } catch (error) {
    return [undefined, new ServiceError('service/unknown-error', error.response.data)];
  }
}

 /**
 * Get the unlocked and locked balance for the subWallet address.
 * If the function failed, success will be false. if it succeeded the balances are returned
 *
 * Example:
 * ```javascript
 * const [success, unlockedBalance, lockedBalance] = getSubWalletBalance(subWalletAddress);
 * ```
 *
 * @param subWalletAddress The subWallet address to check the balance of.
 */
export async function getSubWalletBalance(subWalletAddress: string): Promise<[boolean, number, number]> {
  const [serviceWallet, error] = await getServiceWallet();

  if (error || !serviceWallet) {
    console.error(`failed to get service wallet: ${(error as ServiceError).message}`);
    return [false, 0, 0];
  }

  const [unlockedBalance, lockedBalance] = serviceWallet.wallet.getBalance([subWalletAddress]);
  return [true, unlockedBalance, lockedBalance];
}

export async function waitForWalletSync(wallet: WalletBackend, timeout: number): Promise<boolean> {
  const syncInfoStart = getWalletSyncInfo(wallet);

  console.log(`wait for sync => sync info at start: ${JSON.stringify(syncInfoStart)}`);

  if (syncInfoStart.heightDelta <= 2) {
    return Promise.resolve(true);
  }

  const p1 = new Promise<boolean>(function(resolve, reject) {
    let synced = false;
    wallet.on('sync', (walletHeight, networkHeight) => {
      if (!synced) {
        synced = true;
        console.log(`wallet synced! Wallet height: ${walletHeight}, Network height: ${networkHeight}`);
        resolve(true);
      }
    });
  });

  const p2 = sleep(timeout).then(async (_) => {
    const syncInfoAfterWait = getWalletSyncInfo(wallet);
    const synced            = syncInfoAfterWait.heightDelta <= 2;
    const blocksProcessed   = syncInfoAfterWait.walletHeight - syncInfoStart.walletHeight;

    console.log(`wait for sync => height delta after max wait time: ${JSON.stringify(syncInfoAfterWait)}`);
    console.log(`blocks processed while waiting: ${blocksProcessed}`);

    if (!synced) {
      if (blocksProcessed < 2) {
        const currentNode = wallet.getDaemonConnectionInfo().host;
        console.log(`current node ${currentNode} not processing blocks, calling drop node...`);

        await ServiceModule.dropCurrentNode(currentNode);
      }
    }

    return Promise.resolve(synced);
  });

  return Promise.race([p1, p2]);
}

export async function saveWallet(checkpoint: boolean): Promise<[number | undefined, undefined | ServiceError]> {
  if (!masterWallet) {
    console.log(`no master wallet instance, save failed!`);
    return [undefined, new ServiceError('service/unknown-error', `no master wallet instance, save failed!`)];
  }

  const masterWalletInfo = await getMasterWalletInfo();

  if (!masterWalletInfo) {
    return [undefined, new ServiceError('service/master-wallet-info')];
  }

  loadedFromSave = undefined; // TEMP

  const [wHeight,, nHeight]   = masterWallet.getSyncStatus();
  const encryptedString       = masterWallet.encryptWalletToString(functions.config().serviceadmin.password);
  const timestamp             = Date.now();
  const saveFolder            = 'saved_wallets';

  const saveResults = await Promise.all([
    saveWalletFirebase(encryptedString, saveFolder, checkpoint, wHeight, nHeight, loadedFromSave),
    saveWalletFirebaseOld(masterWalletInfo.location, encryptedString),
    saveWalletAppEngine(encryptedString)
  ]);

  console.log(`save wallet firebase succeeded? ${saveResults[0]}`);
  console.log(`save wallet firebase succeeded (old)? ${saveResults[1]}`);
  console.log(`save wallet appEngine succeeded? ${saveResults[2]}`);

  if (saveResults[0]) {
    const updateObject: WalletInfoUpdate = {
      lastSaveAt: Date.now()
    }

    await admin.firestore().doc('wallets/master').update(updateObject);
  }

  return [timestamp, undefined];
}

export async function updateWalletCheckpoints(): Promise<void> {
  const latestCheckpoint    = await getLatestSavedWallet(true);
  const candidateCheckpoint = await getCandidateCheckpoint(latestCheckpoint);

  if (!candidateCheckpoint) {
    console.log('no validate candidate checkpoint found.');
    return;
  }

  // save new checkpoint
  const docRef    = admin.firestore().collection('wallets/master/saves').doc();
  const saveId    = docRef.id;
  const timestamp = Date.now();

  const checkpoint: SavedWallet = {
    id:             saveId,
    timestamp:      timestamp,
    location:       candidateCheckpoint.location,
    walletHeight:   candidateCheckpoint.walletHeight,
    networkHeight:  candidateCheckpoint.networkHeight,
    checkpoint:     true,
    hasFile:        true,
    isRewind:       false
  }

  await docRef.create(checkpoint);

  // delete non-checkpoints below this new checkpoint
  const snapshot = await admin.firestore().collection('wallets/master/saves')
                    .where('timestamp', '<=', timestamp)
                    .where('checkpoint', '==', false)
                    .where('hasFile', '==', true)
                    .get();

  if (snapshot.size > 0) {
    const oldSaves = snapshot.docs.map(d => d.data() as SavedWallet);
    const deleteOperations = oldSaves.map(s => deleteSavedWallet(s));

    await Promise.all(deleteOperations);
  }
}

async function deleteSavedWallet(savedWallet: SavedWallet): Promise<void> {
  const update: SavedWalletUpdate = {
    hasFile: false
  }

  await admin.firestore().doc(`wallets/master/saves/${savedWallet.id}`).update(update);

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(savedWallet.location);

    await file.delete();
  } catch (error) {
    console.error(error);
  }

  console.log(`deleted saved wallet: ${savedWallet.id}`);
}

async function getCandidateCheckpoint(latestCheckpoint?: SavedWallet): Promise<SavedWallet | undefined> {
  const now = Date.now();
  const saveInterval = 1000 * 60 * 60 * 12; // TODO: refactor constants to config
  const evaluationPeriod = 1000 * 60 * 60 * 24; // the amount of time before and after the canditate to evaluate

  const latestSave = await getLatestSavedWallet(false);

  if (!latestSave) {
    return undefined;
  }

  // at least the specified save interval must have passed since last checkpoint
  if (latestCheckpoint) {
    if (latestCheckpoint.timestamp > now - saveInterval) {
      console.log('not enough time passed since last checkpoint.');
      return undefined;
    }
  }

  // get candidate checkpoint
  const minCutoff = latestCheckpoint ? latestCheckpoint.timestamp + saveInterval : 0;
  const maxCutoff = now - evaluationPeriod;

  const snapshot = await admin.firestore().collection('wallets/master/saves')
                    .where('timestamp', '>=', minCutoff)
                    .where('timestamp', '<', maxCutoff)
                    .where('hasFile', '==', true)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();

  if (snapshot.size === 0) {
    console.log('no valid candidate checkpoint found');
    return undefined;
  }

  const candidate = snapshot.docs[0].data() as SavedWallet;

  // the latest save must be older than the candidate + the evaluation period
  if (latestSave.timestamp < candidate.timestamp + evaluationPeriod) {
    console.log('not eneugh time has passed since candidate checkpoint and last checkpoint.');
    return undefined;
  }

  // TODO: check that no app have last audits marked as failed

  // no failed audits in the evaluation period before and after canditate timestamp
  const audits = await AppsModule.getAppAuditsInPeriod(
                  candidate.timestamp - evaluationPeriod,
                  candidate.timestamp + evaluationPeriod);

  if (audits.some(a => !a.passed)) {
    console.log('candidate has failed audits in the evaluation period.');
    return undefined;
  }

  return candidate;
}

async function saveWalletFirebase(
  encryptedWallet: string,
  folderPath: string,
  checkpoint: boolean,
  walletHeight: number,
  networkHeight: number,
  loadedFrom?: SavedWallet): Promise<boolean> {

  const latestCheckpoint = await getLatestSavedWallet(true);

  if (loadedFrom && latestCheckpoint) {
    // for this save to be allowed, it must have been loaded from a file that has seen the latest checkpoint
    if (loadedFrom.lastSeenCheckpointId !== latestCheckpoint.id) {
      return false;
    }
  }

  const docRef    = admin.firestore().collection('wallets/master/saves').doc();
  const saveId    = docRef.id;
  const timestamp = Date.now();
  const filename  = `wallet_${saveId}_${timestamp}.bin`;
  const location  = `${folderPath}/${filename}`;

  const saveData: SavedWallet = {
    id:             saveId,
    location:       location,
    walletHeight:   walletHeight,
    networkHeight:  networkHeight,
    timestamp:      timestamp,
    checkpoint:     checkpoint,
    hasFile:        true,
    isRewind:       false
  }

  if (latestCheckpoint) {
    saveData.lastSeenCheckpointId = latestCheckpoint.id;
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(location);

    await file.save(encryptedWallet);
    await docRef.set(saveData);

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function getLatestSavedWallet(checkpoint: boolean): Promise<SavedWallet | undefined> {
  const snapshot = await admin.firestore().collection('wallets/master/saves')
                    .where('checkpoint', '==', checkpoint)
                    .where('hasFile', '==', true)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();

  if (snapshot.size !== 1) {
    return undefined;
  }

  return snapshot.docs[0].data() as SavedWallet;
}

async function saveWalletFirebaseOld(filepath: string, encryptedWallet: string): Promise<boolean> {
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(filepath);

    await file.save(encryptedWallet);
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

async function saveWalletAppEngine(encryptedWallet: string): Promise<boolean> {
  try {
    const bucket      = admin.storage().bucket();
    const keyFile     = bucket.file(Constants.gcpServiceAccountFilename);
    const buffer      = await keyFile.download();
    const keyJson     = buffer.toString();
    const keyFilePath = path.join(os.tmpdir(), 'keyfile.json');

    fs.writeFileSync(keyFilePath, keyJson);

    const gcp_storage = new Storage({
      keyFilename: keyFilePath,
      projectId: functions.config().appengine.project_id
    });

    const gcpBucket = gcp_storage.bucket(functions.config().appengine.wallets_bucket);
    const file      = gcpBucket.file(Constants.gcpWalletFilename);

    await file.save(encryptedWallet);

    // delete temp files
    fs.unlinkSync(keyFilePath);

    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}

export async function backupMasterWallet(): Promise<void> {
  const [serviceWallet, walletError] = await getServiceWallet(false);

  if (!serviceWallet) {
    const walletErrorMessage = (walletError as ServiceError).message;
    console.log(`error getting service wallet while performing wallet backup: ${walletErrorMessage}`);
    return;
  }

  const masterWalletInfo = await getMasterWalletInfo();

  if (!masterWalletInfo) {
    console.log('error getting master wallet error.');
    return;
  }

  const timestamp = Date.now();
  const fileName  = `masterwallet_backup_${timestamp}.bin`;

  try {
    const encryptedString = serviceWallet.wallet.encryptWalletToString(functions.config().serviceadmin.password);
    const tempFile        = path.join(os.tmpdir(), fileName);

    fs.writeFileSync(tempFile, encryptedString);

    const bucket  = admin.storage().bucket();
    const file    = bucket.file(`${masterWalletInfo.backupsDirectory}/${fileName}`);

    await file.save(encryptedString);

    // delete temp files
    fs.unlinkSync(tempFile);

    const updateObject: WalletInfoUpdate = {
      lastBackupAt: timestamp
    }

    await admin.firestore().doc('wallets/master').update(updateObject);
  } catch (error) {
    console.error(error);
  }
}

export async function getMasterWalletInfo(): Promise<WalletInfo | undefined> {
  const snapshot = await admin.firestore().doc('wallets/master').get();

  if (snapshot.exists) {
    return snapshot.data() as WalletInfo;
  } else {
    return undefined;
  }
}

export async function getSubWalletInfos(onlyUnclaimed = false): Promise<SubWalletInfo[]> {
  let subWalletDocs: FirebaseFirestore.QuerySnapshot;

  if (onlyUnclaimed) {
    subWalletDocs = await admin.firestore()
                          .collection('wallets/master/subWallets')
                          .where('claimed', '==', false)
                          .get();
  } else {
    subWalletDocs = await admin.firestore().collection('wallets/master/subWallets').get();
  }

  return subWalletDocs.docs.map(d => d.data() as SubWalletInfo);
}

export function getWalletSyncInfo(wallet: WalletBackend): WalletSyncInfo {
  const [walletHeight,, networkHeight] = wallet.getSyncStatus();
  const delta = networkHeight - walletHeight;

  return {
    walletHeight:   walletHeight,
    networkHeight:  networkHeight,
    heightDelta:    delta
  };
}

export async function getAppEngineStatus(jwtToken: string): Promise<WalletStatus | undefined> {
  const appEngineApi = getAppEngineApiBase();
  const statusEndpoint = `${appEngineApi}/status`;

  const reqConfig = {
    headers: { Authorization: "Bearer " + jwtToken }
  }

  try {
    const statusResponse = await axios.get(statusEndpoint, reqConfig);
    return statusResponse.data as WalletStatus;
  } catch (error) {
    console.log(error);

    return undefined;
  }
}

export async function rewindAppEngineWallet(
  distance: number,
  serviceConfig: ServiceConfig): Promise<[number | undefined, undefined | ServiceError]> {

  const [token, jwtError] = await getAppEngineToken();

  if (!token) {
    console.log(`wallet jwt token error: ${(jwtError as ServiceError).message}`);
    return [undefined, jwtError];
  }

  const appEngineApi = getAppEngineApiBase();

  const reqConfig = {
    headers: { Authorization: "Bearer " + token }
  }

  const walletStarted = await warmupAppEngineWallet(token, serviceConfig);

  if (!walletStarted) {
    return [undefined, new ServiceError('service/unknown-error', 'failed to warmup app engine wallet.')]
  }

  const rewindEndpoint = `${appEngineApi}/rewind`;

  console.log(`rewinding App Engine wallet by distance: ${distance}`);

  try {
    const reqBody               = { distance: distance }
    const rewindResponse        = await axios.post(rewindEndpoint, reqBody, reqConfig);
    const walletHeight: number  = rewindResponse.data.walletHeight;

    return [walletHeight, undefined];
  } catch (error) {
    return [undefined, new ServiceError('service/unknown-error', error)];
  }
}

export async function warmupAppEngineWallet(jwtToken: string, serviceConfig: ServiceConfig): Promise<boolean> {
  const status = await getAppEngineStatus(jwtToken);

  if (!status) {
    return false;
  }

  const maxUptime = 1000 * 60 * 60 * 4 // 4 hours
  let restartRequired = false;

  if (!status.started) {
    restartRequired = true;
  } else {
    if (status.daemonHost !== serviceConfig.daemonHost) {
      restartRequired = true;
    }
    if (status.uptime && status.uptime > maxUptime) {
      restartRequired = true;
    }
  }

  if (!restartRequired) {
    return true;
  }

  return await startAppEngineWallet(jwtToken, serviceConfig);
}

export async function startAppEngineWallet(jwtToken: string, serviceConfig: ServiceConfig): Promise<boolean> {
  console.log(`starting up App Engine wallet...`);

  const appEngineApi = getAppEngineApiBase();

  const reqConfig = {
    headers: { Authorization: "Bearer " + jwtToken }
  }

  const startEndpoint = `${appEngineApi}/start`;

  const startBody: StartWalletRequest = {
    daemonHost: serviceConfig.daemonHost,
    daemonPort: serviceConfig.daemonPort
  }

  try {
    const startResponse = await axios.post(startEndpoint, startBody, reqConfig);
    const walletStatus: WalletStatus = startResponse.data;

    return walletStatus.started;
  } catch (error) {
    return false;
  }
}

export async function getAppEngineToken(): Promise<[string | undefined, undefined | ServiceError]> {
  const client_email    = functions.config().appengine.client_email;
  const target_audience = functions.config().appengine.target_audience;
  const private_key_raw = functions.config().appengine.private_key;
  const private_key     = private_key_raw.replace(new RegExp("\\\\n", "\g"), "\n");

  // configure a JWT auth client
  const jwtClient = new google.auth.JWT(
    client_email,
    undefined,
    private_key);

  jwtClient.additionalClaims = {
    target_audience: target_audience
  }

  try {
    const response = await jwtClient.authorize();

    if (response.id_token) {
      return [response.id_token, undefined];
    } else {
      return [undefined, new ServiceError('service/unknown-error')];
    }
  } catch (error) {
    return [undefined, new ServiceError('service/unknown-error', error)];
  }
}

function getAppEngineApiBase(): string {
  return functions.config().appengine.api_base;
}

async function rewindWallet(wallet: WalletBackend, distance :number): Promise<void> {
  const [wHeight] = wallet.getSyncStatus();
  const rewindHeight = wHeight - distance;

  await wallet.rewind(rewindHeight);
}

async function startWalletFromString(
  encryptedString: string,
  daemonHost: string,
  daemonPort: number): Promise<[WalletBackend | undefined, undefined | ServiceError]> {

  const daemon: IDaemon = new Daemon(daemonHost, daemonPort);

  daemon.updateConfig({
    customUserAgentString: Constants.walletBackendUserAgentId
  });

  const [wallet, error] = WalletBackend.openWalletFromEncryptedString(
                            daemon,
                            encryptedString,
                            functions.config().serviceadmin.password);

  if (error || !wallet) {
    console.error('failed to decrypt master wallet!');
    return [undefined, new ServiceError('service/master-wallet-file', 'Failed to decrypt wallet string')];
  } else {
    wallet.enableAutoOptimization(false);
    await wallet.start();

    masterWalletStartedAt = Date.now();
    return [wallet, undefined];
  }
}

async function getMasterWalletString(): Promise<string | null> {
  const masterWalletInfo = await getMasterWalletInfo();

  if (!masterWalletInfo) {
    return null;
  }

  try {
    const bucket = admin.storage().bucket();
    const f = bucket.file(masterWalletInfo.location);

    const buffer = await f.download();
    return buffer.toString();
  } catch (error) {
    console.error(`failed to read wallet file: ${error.message}`);
    return null;
  }
}
