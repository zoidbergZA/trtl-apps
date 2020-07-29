import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as WalletManager from '../walletManager';
import * as axios from 'axios';
import * as sgMail from '@sendgrid/mail';
import { ServiceConfig, ServiceNode, ServiceNodeUpdate, NodeStatus, ServiceConfigUpdate, AppInviteCode } from '../types';
import { sleep } from '../utils';
import { WalletError } from 'turtlecoin-wallet-backend';
import { Account, AccountUpdate, SubWalletInfo, ServiceCharge, ServiceChargeUpdate, ServiceUser, UserRole } from '../../../shared/types';
import { minUnclaimedSubWallets, availableNodesEndpoint, serviceChargesAccountId,
  defaultServiceConfig, defaultNodes } from '../constants';
import { ServiceError } from '../serviceError';
import { UserRecord } from 'firebase-functions/lib/providers/auth';

export async function boostrapService(adminEmail: string): Promise<[string | undefined, undefined | ServiceError]> {
  const [config] = await getServiceConfig();

  if (config !== undefined) {
    return [undefined, new ServiceError('service/master-wallet-info', 'Service already bootstrapped!')];
  }

  let userID: string | undefined;

  try {
    const userRecord = await admin.auth().getUserByEmail(adminEmail);
    userID = userRecord.uid;

    const [serviceUser, userError] = await createServiceUser(userRecord);

    if (!serviceUser) {
      throw Error((userError as ServiceError).message);
    }
  } catch (error) {
    console.log(error);
    return [undefined, new ServiceError('service/unknown-error', error)];
  }

  try {
    await assignUserRole(userID, 'admin');
  } catch (error) {
    console.log(error);
    return [undefined, new ServiceError('service/unknown-error', error)];
  }

  const batch = admin.firestore().batch();

  defaultNodes.forEach(node => {
    const docRef = admin.firestore().doc(`nodes/${node.id}`);
    batch.set(docRef, node);
  });

  await batch.commit();

  const serviceConfig = defaultServiceConfig;
  serviceConfig.adminEmail = adminEmail;

  await Promise.all([
    admin.firestore().doc('globals/config').create(serviceConfig),
    admin.firestore().doc('admin/config').create({ wallet_password: functions.config().serviceadmin.password })
  ]);

  console.log('service config created! creating master wallet...');

  const [seed, walletError] = await WalletManager.createMasterWallet(serviceConfig);

  if (seed) {
    await updateMasterWallet(true);
  }

  return [seed, walletError];
}

exports.onAuthUserCreated = functions.auth.user().onCreate(async (userRecord) => {
  const [serviceUser, userError] = await createServiceUser(userRecord);

  if (!serviceUser) {
    console.log((userError as ServiceError).message);
    return;
  }

  console.log(`new service user created with id: ${serviceUser.id}`);
});

export async function assignUserRole(
  uid: string,
  role: UserRole
): Promise<void> {
  const [user, userError] = await getServiceUser(uid);

  if (!user) {
    const err = userError as ServiceError;
    throw new Error(err.message);
  }

  if (user.roles && user.roles.includes(role)) {
    throw new Error(`user with id [${uid}] already has role [${role}]`);
  }

  const claims: any = {};
  claims[role] = true;

  await admin.auth().setCustomUserClaims(uid, claims);

  await admin.firestore().doc(`serviceUsers/${uid}`).update({
    roles: admin.firestore.FieldValue.arrayUnion(role)
  });
}

export async function removeUserRole(
  uid: string,
  role: UserRole
): Promise<void> {
  const [user, userError] = await getServiceUser(uid);

  if (!user) {
    const err = userError as ServiceError;
    throw new Error(err.message);
  }

  if (!user.roles || !user.roles.includes(role)) {
    throw new Error(`user with id [${uid}] does not have role [${role}]`);
  }

  if (role === 'admin') {
    const [config, configError] = await getServiceConfig();

    if (!config) {
      throw new Error((configError as ServiceError).message);
    }

    if (config.adminEmail === user.email) {
      throw new Error('Can not remove admin role from primary admin user!');
    }
  }

  const claims: any = {};
  claims[role] = false;

  await admin.auth().setCustomUserClaims(uid, claims);

  await admin.firestore().doc(`serviceUsers/${uid}`).update({
    roles: admin.firestore.FieldValue.arrayRemove(role)
  });
}

export async function createInvitationsBatch(amount: number): Promise<[number | undefined, undefined | ServiceError]> {
  const now = Date.now();
  const batch = admin.firestore().batch();

  for (let i = 0; i < amount; i++) {
    const docRef = admin.firestore().collection(`appInvites`).doc();

    const invite: AppInviteCode = {
      code: docRef.id,
      createdAt: now,
      claimed: false
    }

    batch.set(docRef, invite);
  }

  await batch.commit();
  return [amount, undefined];
}

export async function getServiceConfig(): Promise<[ServiceConfig | undefined, undefined | ServiceError]> {
  const configDoc = await admin.firestore().doc('globals/config').get();

  if (!configDoc.exists) {
    return [undefined, new ServiceError('service/not-initialized')];
  }

  const config = configDoc.data() as ServiceConfig;
  return [config, undefined];
}

export async function getServiceChargeAccounts(): Promise<[Account[] | undefined, undefined | ServiceError]> {
  const query = await admin.firestore()
                  .collectionGroup('serviceAccounts')
                  .where('id', '==', 'serviceCharges')
                  .orderBy('balanceUnlocked', 'desc')
                  .get();

  const accounts = query.docs.map(d => d.data() as Account);

  return [accounts, undefined];
}

export async function validateInviteCode(code: string): Promise<boolean> {
  const snapshot = await admin.firestore().doc(`appInvites/${code}`).get();

  if (!snapshot.exists) {
    return false;
  }

  const invite = snapshot.data() as AppInviteCode;

  return !invite.claimed;
}

export async function updateMasterWallet(skipSync: boolean = false): Promise<void> {
  const [serviceWallet, serviceError] = await WalletManager.getServiceWallet(false, false);

  if (!serviceWallet) {
    console.error((serviceError as ServiceError).message);
    return;
  }

  if (serviceWallet.serviceConfig.serviceHalted) {
    console.log(`Service currently halted, skipping update master wallet.`);
    return;
  }

  if (!skipSync) {
    console.log(`master wallet sync job started at: ${Date.now()}`);

    const syncInfoStart   = WalletManager.getWalletSyncInfo(serviceWallet.instance.wallet);
    const balanceStart    = serviceWallet.instance.wallet.getBalance();

    console.log(`sync info at start: ${JSON.stringify(syncInfoStart)}`);
    console.log(`total balance at start: ${JSON.stringify(balanceStart)}`);

    // rewind about 2 hours
    await serviceWallet.instance.wallet.rewind(syncInfoStart.walletHeight - 240);

    const syncSeconds = syncInfoStart.heightDelta < 400 ? 60 : 500;

    console.log(`run sync job for ${syncSeconds}s ...`);
    await sleep(syncSeconds * 1000);

    const syncInfoEnd     = WalletManager.getWalletSyncInfo(serviceWallet.instance.wallet);
    const processedCount  = syncInfoEnd.walletHeight - syncInfoStart.walletHeight;
    const balanceEnd      = serviceWallet.instance.wallet.getBalance();

    console.log(`blocks processed: ${processedCount}`);
    console.log(`sync info at end: ${JSON.stringify(syncInfoEnd)}`);
    console.log(`total balance at end: ${JSON.stringify(balanceEnd)}`);
  }

  // check if we should create more subWallets
  const unclaimedSubWallets = await WalletManager.getSubWalletInfos(true);

  console.log(`unclaimed subWallets count: ${unclaimedSubWallets.length}`);
  const newSubWallets: string[] = [];

  if (unclaimedSubWallets.length < minUnclaimedSubWallets) {
    for (let i = 0; i < minUnclaimedSubWallets; i++) {
      // TODO: refactor add subwallet function to wallet manager

      const [address, error] = serviceWallet.instance.wallet.addSubWallet();

      if (!address) {
        console.error((error as WalletError));
      } else {
        console.log(`created new subWallet: ${address}`);
        newSubWallets.push(address);
      }
    }
  }

  const syncInfo = WalletManager.getWalletSyncInfo(serviceWallet.instance.wallet);

  if (!skipSync && syncInfo.heightDelta <= 0) {
    const optimizeStartAt = Date.now();
    const [numberOfTransactionsSent, ] = await serviceWallet.instance.wallet.optimize();
    const optimizeEndAt = Date.now();
    const optimizeSeconds = (optimizeEndAt - optimizeStartAt) * 0.001;

    console.log(`optimize took: [${optimizeSeconds}]s, # txs sent: [${numberOfTransactionsSent}]`);
  }

  // TODO: compare loadedFrom with latest save here before saving

  const [, saveError] = await WalletManager.saveWallet(serviceWallet.instance, false);

  if (saveError) {
    console.error(saveError.message);
    return;
  }

  if (newSubWallets.length > 0) {
    const batch = admin.firestore().batch();
    let newSubWalletCount = 0;

    // if there are currently no unclaimed wallets, make the new batch available immediately
    const createdAt = unclaimedSubWallets.length === 0 ? 0 : Date.now();

    newSubWallets.forEach(address => {
      const [publicSpendKey, privateSpendKey, err] = serviceWallet.instance.wallet.getSpendKeys(address);

      if (!publicSpendKey || !privateSpendKey || err) {
        console.error(err);
      } else {
        const doc = admin.firestore().collection('wallets/master/subWallets').doc();

        const subWalletInfo: SubWalletInfo = {
          id:               doc.id,
          createdAt:        createdAt,
          address:          address,
          claimed:          false,
          deleted:          false,
          publicSpendKey:   publicSpendKey,
          privateSpendKey:  privateSpendKey
        }

        batch.create(doc, subWalletInfo);
        newSubWalletCount++;
      }
    });

    try {
      await batch.commit();
      console.log(`successfully added ${newSubWalletCount} new unclaimed subWallets.`);
    } catch (error) {
      console.error(`error while adding new subWallets: ${error}`);
    }
  }
}

export async function processServiceCharges(): Promise<void> {
  const processingDocs = await admin.firestore()
                          .collectionGroup('serviceCharges')
                          .where('status', '==', 'processing')
                          .get();

  if (processingDocs.size === 0) {
    return;
  }

  const charges   = processingDocs.docs.map(d => d.data() as ServiceCharge);
  const promises  = charges.map(c => processServiceCharge(c.appId, c.id));

  await Promise.all(promises);
}

export async function dropCurrentNode(currentNodeUrl: string): Promise<void> {
  console.log(`dropping current service node: ${currentNodeUrl}`);

  const [serviceConfig, configError] = await getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);
    return;
  }

  if (serviceConfig.daemonHost !== currentNodeUrl) {
    console.log(`current service node already changed, skipping drop node.`);
    return;
  }

  const currentNode = await getServiceNodeByUrl(currentNodeUrl);

  if (!currentNode) {
    console.log(`unable to find service node by url: [${currentNodeUrl}], skipping drop node.`);
    return;
  }

  const nodesSnaphot = await admin.firestore()
                        .collection('nodes')
                        .where('online', '==', true)
                        .orderBy('priority', 'desc')
                        .get();

  if (nodesSnaphot.size === 0) {
    return;
  }

  const nodes = nodesSnaphot.docs.map(d => d.data() as ServiceNode);
  const now = Date.now();

  // only consider nodes that have not dropped in the last 30 minutes
  const candidateNodes = nodes.filter(n => ((n.lastDropAt + 30 * 60 * 1000) < now) && n.url !== currentNodeUrl);

  if (candidateNodes.length === 0) {
    console.log('no candidate nodes available, skipping drop node.');
    return;
  }

  const newNode = candidateNodes[0];

  const configUpdate: ServiceConfigUpdate = {
    daemonHost: newNode.url,
    daemonPort: newNode.port
  }

  const droppedNodeUpdate: ServiceNodeUpdate = {
    lastUpdateAt: now,
    lastDropAt: now
  }

  const configPromise = admin.firestore().doc(`globals/config`).update(configUpdate);
  const nodePromise   = admin.firestore().doc(`nodes/${currentNode.id}`).update(droppedNodeUpdate);

  try {
    await Promise.all([configPromise, nodePromise]);

    console.log(`node: ${currentNodeUrl} dropped, new node: ${newNode.url}`);
  } catch (error) {
    console.log(error);
  }
}

export async function checkNodeSwap(): Promise<void> {
  const nodesSnaphot = await admin.firestore()
                        .collection('nodes')
                        .where('online', '==', true)
                        .orderBy('priority', 'desc')
                        .get();

  const nodes = nodesSnaphot.docs.map(d => d.data() as ServiceNode);
  const now = Date.now();

  // only consider nodes that have not dropped in the last 60 minutes
  const candidateNodes = nodes.filter(n => (n.lastDropAt + 60 * 60 * 1000) < now);

  if (candidateNodes.length === 0) {
    return;
  }

  const recommendedNode = candidateNodes[0];
  const [serviceConfig, configError] = await getServiceConfig();

  if (!serviceConfig) {
    console.log((configError as ServiceError).message);
    return;
  }

  const currentNodeUrl = serviceConfig.daemonHost;

  if (currentNodeUrl !== recommendedNode.url) {
    console.log(`changing service node from ${currentNodeUrl} to: ${recommendedNode.url}`);

    const updateObject: ServiceConfigUpdate = {
      daemonHost: recommendedNode.url,
      daemonPort: recommendedNode.port
    }

    await admin.firestore().doc(`globals/config`).update(updateObject);
  }
}

export async function updateServiceNodes(): Promise<void> {
  try {
    const serviceNodesSnapshot    = await admin.firestore().collection('nodes').get();
    const availableNodesResponse  = await axios.default.get(availableNodesEndpoint);

    const serviceNodes = serviceNodesSnapshot.docs.map(d => d.data() as ServiceNode);
    const nodeStatuses = availableNodesResponse.data.nodes as NodeStatus[];

    if (serviceNodes.length === 0 || nodeStatuses.length === 0) {
      return;
    }

    console.log(`service nodes: #${serviceNodesSnapshot.size}, available nodes: #${nodeStatuses.length}`);

    await doServiceNodeUpdates(serviceNodes, nodeStatuses);

  } catch (error) {
    console.error(error);
  }
}

async function processServiceCharge(appId: string, chargeId: string): Promise<void> {
  try {
    await admin.firestore().runTransaction(async (txn): Promise<any> => {
      const chargeAccountDocRef = admin.firestore().doc(`apps/${appId}/serviceAccounts/${serviceChargesAccountId}`);
      const chargeAccountDoc    = await txn.get(chargeAccountDocRef);

      if (!chargeAccountDoc.exists) {
        return Promise.reject('service charge account not found.');
      }

      const chargeAccount   = chargeAccountDoc.data() as Account;
      const chargeDocRef    = admin.firestore().doc(`apps/${appId}/serviceCharges/${chargeId}`);
      const chargeDoc       = await txn.get(chargeDocRef);

      if (!chargeDoc.exists) {
        return Promise.reject('service charge doc does not exist.');
      }

      const serviceCharge = chargeDoc.data() as ServiceCharge;

      if (serviceCharge.status !== 'processing') {
        console.error(`service charge [${serviceCharge.id}] in invalid state [${serviceCharge.status}], skipping processing.`);
        return Promise.reject('service chargce has incorrect status');
      }

      if (serviceCharge.cancelled) {
        const chargeAccountUpdate: AccountUpdate = {
          balanceLocked: chargeAccount.balanceLocked - serviceCharge.amount,
        }

        txn.update(chargeAccountDocRef, chargeAccountUpdate);
      } else {
        const chargeAccountUpdate: AccountUpdate = {
          balanceLocked:    chargeAccount.balanceLocked - serviceCharge.amount,
          balanceUnlocked:  chargeAccount.balanceUnlocked + serviceCharge.amount
        }

        txn.update(chargeAccountDocRef, chargeAccountUpdate);
      }

      const chargeDocUpdate: ServiceChargeUpdate = {
        lastUpdate: Date.now(),
        status: 'completed'
      }

      txn.update(chargeDocRef, chargeDocUpdate);
    });
  } catch (error) {
    console.error(error);
  }
}

export async function haltService(reason: string): Promise<void> {
  const configUpdate: ServiceConfigUpdate = {
    serviceHalted: true
  }

  await admin.firestore().doc(`globals/config`).update(configUpdate);
  await sendAdminEmail('Alert - Service halted!', reason);
}

export async function createServiceUser(userRecord: UserRecord): Promise<[ServiceUser | undefined, undefined | ServiceError]> {
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

  try {
    await admin.firestore().doc(`serviceUsers/${id}`).set(serviceUser);
    return [serviceUser, undefined];
  } catch (error) {
    return [undefined, new ServiceError('service/unknown-error', error)];
  }
}

export async function getServiceUser(uid: string): Promise<[ServiceUser | undefined, undefined | ServiceError]> {
  const userDoc = await admin.firestore().doc(`serviceUsers/${uid}`).get();

  if (!userDoc.exists) {
    return [undefined, new ServiceError('service/unknown-error', 'service user not found.')];
  }

  return [userDoc.data() as ServiceUser, undefined];
}

export async function getServiceUserByEmail(email: string): Promise<[ServiceUser | undefined, undefined | ServiceError]> {
  const snaphsot = await admin.firestore().collection(`serviceUsers`)
                    .where('email', '==', email)
                    .get();

  if (snaphsot.size !== 1) {
    return [undefined, new ServiceError('service/unknown-error', 'service user not found.')];
  }

  return [snaphsot.docs[0].data() as ServiceUser, undefined];
}

export async function sendAdminEmail(subject: string, body: string): Promise<void> {
  const sendGridKey = functions.config().sendgrid.apikey;

  if (!sendGridKey) {
    console.log(`SendGrid API key not set, skipping send email.`);
    return;
  }

  sgMail.setApiKey(sendGridKey);

  const [config, serviceError] = await getServiceConfig();

  if (!config) {
    console.log((serviceError as ServiceError).message);
    return;
  }

  if (!config.adminEmail) {
    console.log(`Service admin email not set, skipping send email.`);
    return;
  }

  const msg = {
    to: config.adminEmail,
    from: 'trtlapps@gmail.com',
    subject: subject,
    text: body
  };

  await sgMail.send(msg);
}

async function getServiceNodeByUrl(url: string): Promise<ServiceNode | undefined> {
  const snapshot = await admin.firestore().collection('nodes').where('url', '==', url).get();

  if (snapshot.size !== 1) {
    return undefined;
  }

  return snapshot.docs[0].data() as ServiceNode;
}

function doServiceNodeUpdates(serviceNodes: ServiceNode[], nodeStatuses: NodeStatus[]): Promise<any> {
  const now   = Date.now();
  const batch = admin.firestore().batch();

  serviceNodes.forEach(serviceNode => {
    const docRef = admin.firestore().doc(`nodes/${serviceNode.id}`);
    const status = nodeStatuses.find(s => s.url === serviceNode.url);

    const updateObject: ServiceNodeUpdate = {
      lastUpdateAt: now,
    };

    if (status) {
      updateObject.lastUpdateAt = status.timestamp;
      updateObject.cache        = status.cache;
      updateObject.fee          = status.fee.amount;
      updateObject.availability = status.availability;
      updateObject.name         = status.name;
      updateObject.online       = status.online;
      updateObject.ssl          = status.ssl;
      updateObject.version      = status.version;
    } else {
      updateObject.availability = 0;
      updateObject.online       = false;
    }

    batch.update(docRef, updateObject);
  });

  return batch.commit();
}
