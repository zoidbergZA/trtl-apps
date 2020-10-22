import axios, { AxiosError } from 'axios';
import * as functions from 'firebase-functions';
import * as ServiceModule from './modules/serviceModule';
import * as AuditsModule from './modules/auditsModule';
import * as Constants from './constants';
import * as admin from 'firebase-admin';
import { v4 as uuidv4 } from 'uuid';
import { WalletBackend, Daemon, WalletError } from 'turtlecoin-wallet-backend';
import { sleep } from './utils';
import { ServiceError } from './serviceError';
import { ServiceWallet, ServiceConfig, WalletSyncInfo,
  SavedWallet, SavedWalletUpdate, WalletInstance } from './types';
import { SubWalletInfo, WalletStatus, SubWalletInfoUpdate, GoogleServiceAccountKey, PrepareTransactionRequest, ServiceWalletInfo, SendTransactionRequest } from '../../shared/types';
import { SendTransactionResult } from 'turtlecoin-wallet-backend/dist/lib/Types';
import { google } from 'googleapis';

let sharedInstance: WalletInstance | undefined;

export async function createMasterWallet(serviceConfig: ServiceConfig): Promise<[string | undefined, undefined | ServiceError]> {
  console.log('creating new master wallet...');

  const daemon = new Daemon(serviceConfig.daemonHost, serviceConfig.daemonPort);

  const wallet = await WalletBackend.createWallet(daemon);
  await wallet.start();

  // give the new wallet time to sync
  await sleep(20 * 1000);

  // TODO: check that wallet is synced

  const [wHeight,, nHeight]   = wallet.getSyncStatus();
  const encryptedString       = wallet.encryptWalletToString(functions.config().serviceadmin.password);
  const saveFolder            = 'saved_wallets';

  const saveData = await saveWalletFirebase(encryptedString, saveFolder, wHeight, nHeight, false);

  if (!saveData) {
    console.error('error saving master wallet!');
    return [undefined, new ServiceError('service/master-wallet-file', 'an error ocurred while saving wallet to firebase!')];
  }

  const [seed, seedError] = await wallet.getMnemonicSeed();

  if (!seed) {
    return [undefined, new ServiceError('service/master-wallet-info', (seedError as WalletError).toString())];
  }

  return [seed, undefined];
}

export async function getWalletStatus(): Promise<[WalletStatus[] | undefined, undefined | ServiceError]> {
  const [serviceWallet, serviceWalletError] = await getServiceWallet(false);

  let firebaseWalletStatus: WalletStatus = {
    name: 'firebase',
    started: false
  }

  let appEngineWalletStatus: WalletStatus = {
    name: 'app engine',
    started: false
  }

  if (serviceWallet) {
    firebaseWalletStatus = getFirebaseWalletStatus(serviceWallet);
    const [token, tokenError] = await getAppEngineToken();

    if (token) {
      appEngineWalletStatus = await getAppEngineWalletStatus(token);
    } else {
      appEngineWalletStatus.error = (tokenError as ServiceError).message;
    }
  } else if (serviceWalletError) {
    console.log(serviceWalletError.message);

    firebaseWalletStatus.error = serviceWalletError.message;
    appEngineWalletStatus.error = serviceWalletError.message;
  }

  return [[firebaseWalletStatus, appEngineWalletStatus], undefined];
}

export async function getServiceWallet(
  waitForSync: boolean = true,
  shared: boolean = true): Promise<[ServiceWallet | undefined, undefined | ServiceError]> {

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    return [undefined, configError];
  }

  if (serviceConfig.serviceHalted) {
    return [undefined, new ServiceError('service/service-halted')];
  }

  const [instance, openError] = await getWalletInstance(serviceConfig, shared);

  if (!instance) {
    console.log((openError as ServiceError).message);
    return [undefined, openError];
  }

  const serviceWallet: ServiceWallet = {
    instance: instance,
    serviceConfig: serviceConfig
  }

  if (!waitForSync) {
    return [serviceWallet, undefined];
  }

  const syncStart     = Date.now();
  const synced        = await waitForWalletSync(instance.wallet, serviceConfig.waitForSyncTimeout);
  const syncEnd       = Date.now();
  const syncSeconds   = (syncEnd - syncStart) / 1000;

  console.log(`sync successful? [${synced}], sync time: ${syncSeconds}(s)`);

  if (!synced) {
    await closeSharedInstance();

    return [undefined, new ServiceError('service/master-wallet-sync-failed')];
  }

  return [serviceWallet, undefined];
}

export async function prepareAccountTransaction(
  serviceConfig: ServiceConfig,
  appWallet: string,
  accountId: string,
  sendAddress: string,
  paymentId: string,
  amount: number): Promise<[SendTransactionResult | undefined, undefined | ServiceError]> {

  const fetchResult = await Promise.all([getAppEngineToken(), getLatestSavedWallet(false)]);

  const [token, jwtError] = fetchResult[0];
  const latestSave = fetchResult[1];

  if (!token) {
    console.log(`wallet jwt token error: ${(jwtError as ServiceError).message}`);
    return [undefined, jwtError];
  }

  if (!latestSave) {
    return [undefined, new ServiceError('service/master-wallet-file')];
  }

  const serviceWalletInfo: ServiceWalletInfo = {
    daemonHost: serviceConfig.daemonHost,
    daemonPort: serviceConfig.daemonPort,
    filePath:   latestSave.location
  }

  const txRequest: PrepareTransactionRequest = {
    serviceWalletInfo:  serviceWalletInfo,
    subWallet:          appWallet,
    senderId:           accountId,
    sendAddress:        sendAddress,
    amount:             amount,
    paymentId:          paymentId
  }

  const appEngineApi = getAppEngineApiBase();
  const endpoint = `${appEngineApi}/prepare_transaction`;

  const reqConfig = {
    headers: { Authorization: "Bearer " + token }
  }

  try {
    const response = await axios.post(endpoint, txRequest, reqConfig);
    const sendResult = response.data as SendTransactionResult;

    return [sendResult, undefined];
  } catch (error) {
    return [undefined, error.response.data];
  }
}

export async function sendPreparedTransaction(
  preparedTxHash: string,
  serviceConfig: ServiceConfig): Promise<[SendTransactionResult | undefined, undefined | ServiceError]> {

  const fetchResult = await Promise.all([getAppEngineToken(), getLatestSavedWallet(false)]);

  const [token, jwtError] = fetchResult[0];
  const latestSave = fetchResult[1];

  if (!token) {
    console.log(`wallet jwt token error: ${(jwtError as ServiceError).message}`);
    return [undefined, jwtError];
  }

  if (!latestSave) {
    return [undefined, new ServiceError('service/master-wallet-file')];
  }

  const serviceWalletInfo: ServiceWalletInfo = {
    daemonHost: serviceConfig.daemonHost,
    daemonPort: serviceConfig.daemonPort,
    filePath: latestSave.location
  }

  const body: SendTransactionRequest = {
    serviceWalletInfo,
    preparedTxHash
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
    const axiosError = error as AxiosError;
    const response = axiosError.response;

    console.log(`send transaction error: ${JSON.stringify(axiosError)}`);

    if (response && (response.status === 400 || response.status === 500)) {
      return [undefined, new ServiceError('service/unknown-error', response.statusText)];
    }

    // In this case the transaction MAY still have been sent, but we do not know fore sure.
    return [undefined, new ServiceError('app/withdrawal-lost', error.response.data)];
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

  const [unlockedBalance, lockedBalance] = await serviceWallet.instance.wallet.getBalance([subWalletAddress]);
  return [true, unlockedBalance, lockedBalance];
}

export async function saveWallet(instance: WalletInstance, isRewind: boolean): Promise<[SavedWallet | undefined, undefined | ServiceError]> {
  const [wHeight,, nHeight]   = instance.wallet.getSyncStatus();
  const encryptedString       = instance.wallet.encryptWalletToString(functions.config().serviceadmin.password);
  const saveFolder            = 'saved_wallets';

  const firebaseSave = await saveWalletFirebase(encryptedString, saveFolder, wHeight, nHeight, isRewind);

  if (!firebaseSave) {
    return [undefined, new ServiceError('service/master-wallet-file', 'an error ocurred while saving wallet to firebase!')];
  }

  console.log(`wallet file saved: ${firebaseSave.location}`);

  return [firebaseSave, undefined];
}

export async function getLatestSavedWallet(checkpoint: boolean): Promise<SavedWallet | undefined> {
  const snapshot = await admin.firestore().collection('wallets/master/saves')
                    .where('checkpoint', '==', checkpoint)
                    .where('hasFile', '==', true)
                    .orderBy('timestamp', 'desc')
                    .limit(1)
                    .get();

  if (snapshot.size === 0) {
    return undefined;
  }

  return snapshot.docs[0].data() as SavedWallet;
}

export async function updateWalletCheckpoints(): Promise<void> {
  const latestCheckpoint    = await getLatestSavedWallet(true);
  const candidateCheckpoint = await getCandidateCheckpoint(latestCheckpoint);

  if (!candidateCheckpoint) {
    console.log('no validate candidate checkpoint found.');
    return;
  }

  const docRef = admin.firestore().doc(`wallets/master/saves/${candidateCheckpoint.id}`);

  const update: SavedWalletUpdate = {
    checkpoint: true
  }

  await docRef.update(update);

  // delete non-checkpoints below this new checkpoint
  const snapshot = await admin.firestore().collection('wallets/master/saves')
                    .where('timestamp', '<=', candidateCheckpoint.timestamp)
                    .where('checkpoint', '==', false)
                    .where('hasFile', '==', true)
                    .limit(100)
                    .get();

  if (snapshot.size > 0) {
    const oldSaves = snapshot.docs.map(d => d.data() as SavedWallet);
    const deleteOperations = oldSaves.map(s => deleteSavedWallet(s));

    await Promise.all(deleteOperations);
  }
}

export async function getSubWalletInfos(onlyUnclaimed: boolean): Promise<SubWalletInfo[]> {
  let subWalletDocs: FirebaseFirestore.QuerySnapshot;

  if (onlyUnclaimed) {
    subWalletDocs = await admin.firestore()
                      .collection('wallets/master/subWallets')
                      .where('claimed', '==', false)
                      .where('deleted', '==', false)
                      .get();
  } else {
    subWalletDocs = await admin.firestore().collection('wallets/master/subWallets').get();
  }

  return subWalletDocs.docs.map(d => d.data() as SubWalletInfo);
}

export async function validateUnclaimedSubWallets(): Promise<void> {
  const [serviceWallet, serviceError] = await getServiceWallet(false, true);

  if (!serviceWallet) {
    console.log((serviceError as ServiceError).message);
    return;
  }

  const unclaimedSubWallets = await getSubWalletInfos(true);
  const walletAddreses      = serviceWallet.instance.wallet.getAddresses();

  const invalidSubWallets = unclaimedSubWallets.filter(w => !w.deleted && !walletAddreses.some(a => a === w.address));

  if (invalidSubWallets.length === 0) {
    return;
  }

  const deletePromises = invalidSubWallets.map(w => deleteSubWallet(w));

  await Promise.all(deletePromises);
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

export async function startAppEngineWallet(jwtToken: string, serviceConfig: ServiceConfig): Promise<boolean> {
  console.log(`starting up App Engine wallet...`);

  const latestSave = await getLatestSavedWallet(false);

  if (!latestSave) {
    console.log('failed to get latest saved wallet file.');
    return false;
  }

  const appEngineApi = getAppEngineApiBase();

  const reqConfig = {
    headers: { Authorization: "Bearer " + jwtToken }
  }

  const startEndpoint = `${appEngineApi}/start`;

  const startBody: ServiceWalletInfo = {
    daemonHost: serviceConfig.daemonHost,
    daemonPort: serviceConfig.daemonPort,
    filePath: latestSave.location
  }

  try {
    const startResponse = await axios.post(startEndpoint, startBody, reqConfig);
    const walletStatus: WalletStatus = startResponse.data;

    console.log('app engine wallet status:');
    console.log(JSON.stringify(walletStatus));

    return walletStatus.started;
  } catch (error) {
    return false;
  }
}

export async function getAppEngineToken(): Promise<[string | undefined, undefined | ServiceError]> {
  const tokenDoc = await admin.firestore().doc('admin/app_engine_token').get();

  if (tokenDoc.exists) {
    const credentials: any = tokenDoc.data();

    console.log(`using cached app engine auth token, expires at: ${credentials.expiry_date}`);

    if (credentials.id_token && credentials.expiry_date && credentials.expiry_date > Date.now()) {
      return [credentials.id_token, undefined];
    }
  }

  const target_audience = functions.config().appengine.target_audience;
  const key = await getGoogleServiceAccountKey();

  if (!key) {
    return [undefined, new ServiceError('service/unknown-error', 'An error occured while fetching google service account key.')];
  }

  // configure a JWT auth client
  const jwtClient = new google.auth.JWT(
    key.client_email,
    undefined,
    key.private_key);

  jwtClient.additionalClaims = {
    target_audience: target_audience
  }

  try {
    const response = await jwtClient.authorize();

    if (response.id_token) {
      // cache the token
      const expiry_date = Date.now() + 1000 * 60 * 10; // TODO: replace hard-coded value with actual date if possible

      await admin.firestore().doc('admin/app_engine_token').set({
        id_token: response.id_token,
        expiry_date: expiry_date
      });

      return [response.id_token, undefined];
    } else {
      return [undefined, new ServiceError('service/unknown-error')];
    }
  } catch (error) {
    console.log(error);
    return [undefined, new ServiceError('service/unknown-error', error)];
  }
}

export async function rewindToCheckpoint(previousCheckpoint: SavedWallet): Promise<[SavedWallet | undefined, undefined | ServiceError]> {
  if (!previousCheckpoint.checkpoint) {
    return [undefined, new ServiceError('service/unknown-error', 'supplied saved wallet is not a checkpoint!')];
  }

  if (!previousCheckpoint.hasFile) {
    return [undefined, new ServiceError('service/unknown-error', 'supplied saved wallet does not have a file!')];
  }

  const [serviceConfig, configError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    return [undefined, configError];
  }

  const fetchResults = await Promise.all([
    getWalletInstance(serviceConfig, false),
    getAppEngineToken()
  ]);

  const [walletInstance, serviceError] = fetchResults[0];
  const [token, tokenError] = fetchResults[1];

  if (!walletInstance) {
    throw new functions.https.HttpsError('internal', (serviceError as ServiceError).message);
  }

  if (!token) {
    throw new functions.https.HttpsError('internal', (tokenError as ServiceError).message);
  }

  const rewindHeight = previousCheckpoint.walletHeight;

  console.log(`rewind wallet to height: ${rewindHeight}`);
  await walletInstance.wallet.rewind(rewindHeight);

  const saveDelay = 1000 * 10;

  console.log(`delay ${saveDelay}ms before wallet save...`);
  await sleep(saveDelay);

  console.log(`sync info at save: ${walletInstance.wallet.getSyncStatus()}`);
  const [savedWallet, saveError] = await saveWallet(walletInstance, true);

  if (!savedWallet) {
    return [undefined, saveError];
  }

  const appEngineRestarted = await startAppEngineWallet(token, serviceConfig);
  console.log(`app engine wallet successfully restarted? ${appEngineRestarted}`);

  return [savedWallet, undefined];
}

async function deleteSubWallet(subWallet: SubWalletInfo): Promise<boolean> {
  const update: SubWalletInfoUpdate = {
    deleted: true
  }

  try {
    await admin.firestore().doc(`wallets/master/subWallets/${subWallet.id}`).update(update);
    return true;
  } catch (error) {
    console.log(error);
    return false;
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

async function waitForWalletSync(wallet: WalletBackend, timeout: number): Promise<boolean> {
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

async function getCandidateCheckpoint(latestCheckpoint?: SavedWallet): Promise<SavedWallet | undefined> {
  const now = Date.now();
  const saveInterval = 1000 * 60 * 60 * 12; // TODO: refactor constants to config
  const evaluationPeriod = 1000 * 60 * 60 * 24;

  // at least the specified save interval must have passed since last checkpoint
  if (latestCheckpoint) {
    console.log(`latest checkpoint: ${latestCheckpoint.id}, timestamp: ${latestCheckpoint.timestamp}`);

    if (latestCheckpoint.timestamp > now - saveInterval) {
      console.log('not enough time passed since last checkpoint.');
      return undefined;
    }
  }

  const maxCutoff = now - evaluationPeriod;
  const minCutoff = maxCutoff - (2 * evaluationPeriod);

  console.log(`minCutoff: ${minCutoff}`);
  console.log(`maxCutoff: ${maxCutoff}`);

  const querySnapshot = await admin.firestore()
                          .collection('wallets/master/saves')
                          .where('timestamp', '<', maxCutoff)
                          .where('timestamp', '>', minCutoff)
                          .where('hasFile', '==', true)
                          .orderBy('timestamp', 'desc')
                          .get();

  if (querySnapshot.size === 0) {
    console.log('no checkpoint candidates found in the evaluation period.');
    return undefined;
  }

  const candidates = querySnapshot.docs.map(d => d.data() as SavedWallet);
  const hasRewind = candidates.some(c => c.isRewind);

  if (hasRewind) {
    console.log(`wallet rewind(s) occured in the evaluation period, skipping checkpoint creation.`);
    return undefined;
  }

  const candidate = candidates[0];

  // check no failed audits in the evaluation period before and after canditate timestamp
  const audits = await AuditsModule.getAppAuditsInPeriod(
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
  walletHeight: number,
  networkHeight: number,
  isRewind: boolean): Promise<SavedWallet | undefined> {

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
    checkpoint:     false,
    hasFile:        true,
    isRewind:       isRewind
  }

  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file(location);

    await file.save(encryptedWallet);
    await docRef.set(saveData);

    return saveData;
  } catch (error) {
    console.error(error);
    return undefined;
  }
}

async function getWalletInstance(
  serviceConfig: ServiceConfig,
  shared = true): Promise<[WalletInstance | undefined, undefined | ServiceError]> {

  const latestSave = await getLatestSavedWallet(false);

  if (!latestSave) {
    console.log('failed to get latest save!');
    return [undefined, new ServiceError('service/master-wallet-file')];
  }

  if (shared && sharedInstance) {
    if (await checkWalletInstanceRestartNeeded(sharedInstance, latestSave, serviceConfig)) {
      console.log(`starting new wallet instance...`);

      await closeSharedInstance();
    } else {
      return [sharedInstance, undefined];
    }
  }

  const encryptedString = await getMasterWalletString(latestSave);

  if (!encryptedString) {
    console.error('no master wallet file data.');
    return [undefined, new ServiceError('service/master-wallet-file')];
  }

  console.log(`starting wallet instance from saved file: ${latestSave.id}, location: ${latestSave.location}`);

  const [wallet, error] = await startWalletFromString(encryptedString, serviceConfig.daemonHost, serviceConfig.daemonPort);

  if (wallet) {
    const instance = new WalletInstance(wallet, latestSave, uuidv4(), Date.now());

    if (shared) {
      sharedInstance = instance;
    }

    return [instance, undefined];
  } else {
    return [undefined, error];
  }
}

async function checkWalletInstanceRestartNeeded(
  instance: WalletInstance,
  latestSave: SavedWallet,
  serviceConfig: ServiceConfig): Promise<boolean> {

  const daemonInfo = instance.wallet.getDaemonConnectionInfo();

  if (instance.loadedFrom.id !== latestSave.id) {
    console.log(`newer saved file [${latestSave.location}] detected, restart needed.`);
    return true;
  }

  if (daemonInfo.host !== serviceConfig.daemonHost || daemonInfo.port !== serviceConfig.daemonPort) {
    console.log('daemon info changed, restart needed.');
    return true;
  }

  return false;
}

function getFirebaseWalletStatus(serviceWallet: ServiceWallet): WalletStatus {
  const firebaseSyncInfo = serviceWallet.instance.wallet.getSyncStatus();
  const connectionInfo = serviceWallet.instance.wallet.getDaemonConnectionInfo();

  const walletStatus: WalletStatus = {
    name: 'firebase',
    started: true,
    walletHeight: firebaseSyncInfo[0],
    networkHeight: firebaseSyncInfo[2],
    daemonHost: connectionInfo.host,
    daemonPort: connectionInfo.port,
    uptime: Date.now() - serviceWallet.instance.startedAt
  }

  return walletStatus;
}

async function getAppEngineWalletStatus(token: string): Promise<WalletStatus> {
  const appEngineApi = getAppEngineApiBase();
  const statusEndpoint = `${appEngineApi}/status`;

  const reqConfig = {
    headers: { Authorization: "Bearer " + token }
  }

  try {
    const statusResponse = await axios.get(statusEndpoint, reqConfig);
    return statusResponse.data as WalletStatus;
  } catch (error) {
    console.log(error);

    const status: WalletStatus = {
      name: 'app engine',
      started: false,
      error: error
    }

    return status;
  }
}

async function closeSharedInstance() {
  if (!sharedInstance) {
    return;
  }

  await sharedInstance.wallet.stop();

  sharedInstance.wallet.removeAllListeners();
  sharedInstance = undefined;
}

function getAppEngineApiBase(): string {
  return `https://${process.env.GCLOUD_PROJECT}.appspot.com`;
}

async function startWalletFromString(
  encryptedString: string,
  daemonHost: string,
  daemonPort: number): Promise<[WalletBackend | undefined, undefined | ServiceError]> {

  const daemon = new Daemon(daemonHost, daemonPort);

  daemon.updateConfig({
    customUserAgentString: Constants.walletBackendUserAgentId
  });

  const [wallet, error] = await WalletBackend.openWalletFromEncryptedString(
                            daemon,
                            encryptedString,
                            functions.config().serviceadmin.password);

  if (error || !wallet) {
    console.error('failed to decrypt master wallet!');
    return [undefined, new ServiceError('service/master-wallet-file', 'Failed to decrypt wallet string')];
  } else {
    wallet.enableAutoOptimization(false);
    await wallet.start();

    return [wallet, undefined];
  }
}

async function getMasterWalletString(savedWallet: SavedWallet): Promise<string | null> {
  try {
    const bucket = admin.storage().bucket();
    const f = bucket.file(savedWallet.location);

    const buffer = await f.download();
    return buffer.toString();
  } catch (error) {
    console.error(`failed to read wallet file: ${error.message}`);
    return null;
  }
}

async function getGoogleServiceAccountKey(): Promise<GoogleServiceAccountKey | null> {
  try {
    const bucket  = admin.storage().bucket();
    const file    = bucket.file('gcp_account_key.json');
    const buffer  = await file.download();
    const json    = buffer.toString();

    const key: GoogleServiceAccountKey = JSON.parse(json);
    return key;
  } catch (error) {
    console.error(`failed to read google service account key file: ${error.message}`);
    return null;
  }
}
