import * as admin from 'firebase-admin';
import * as WalletManager from './walletManager';
import { ServiceConfig } from './types';
import { sleep } from './utils';
import { WalletError } from 'turtlecoin-wallet-backend';
import { SubWalletInfo } from '../../shared/types';
import { minUnclaimedSubWallets } from './constants';
import { ServiceError } from './serviceError';

export async function boostrapService(): Promise<[string | undefined, undefined | ServiceError]> {
  const masterWalletInfo = await WalletManager.getMasterWalletInfo();

  if (masterWalletInfo !== undefined) {
    return [undefined, new ServiceError('service/master-wallet-info', 'Service already bootstrapped!')];
  }

  // TODO: comment all these properties
  const serviceConfig: ServiceConfig = {
    daemonHost:             'blockapi.turtlepay.io',
    daemonPort:             443,
    nodeFee:                10,
    txScanDepth:            2 * 60 * 24 * 7, // scan txs up to aprox 7 days in the past
    txConfirmations:        6,
    withdrawTimoutBlocks:   20,
    waitForSyncTimeout:     20000,
    serviceHalted:          false
  }

  // // TODO: set default node list in firestore
  // const nodes: NodeInfo[] = [
  //   {
  //     name: 'TurtlePay Blockchain Cache - SSL',
  //     url: 'blockapi.turtlepay.io',
  //     port: 443,
  //     ssl: true,
  //     cache: true,
  //     priority: 10
  //   },
  //   {
  //     name: 'TurtlePay Blockchain Cache',
  //     url: 'node.trtlpay.com',
  //     port: 80,
  //     ssl: false,
  //     cache: true,
  //     priority: 9
  //   },
  //   {
  //     name: 'Hashvault.pro turtle node',
  //     url: 'nodes.hashvault.pro',
  //     port: 11898,
  //     ssl: false,
  //     cache: false,
  //     priority: 8
  //   }
  // ];

  await admin.firestore().doc('globals/config').set(serviceConfig);

  console.log('service config created! creating master wallet...');
  return await WalletManager.createMasterWallet(serviceConfig);
}

export async function getServiceConfig(): Promise<[ServiceConfig | undefined, undefined | ServiceError]> {
  const configDoc = await admin.firestore().doc('globals/config').get();

  if (!configDoc.exists) {
    return [undefined, new ServiceError('service/not-initialized')];
  }

  const config = configDoc.data() as ServiceConfig;
  return [config, undefined];
}

export async function updateMasterWallet(): Promise<void> {
  console.log(`master wallet sync job started at: ${Date.now()}`);

  const [serviceConfig, serviceConfigError] = await getServiceConfig();

  if (!serviceConfig) {
    console.error((serviceConfigError as ServiceError).message);
    return;
  }

  const [wallet, walletError] = await WalletManager.getMasterWallet(serviceConfig);

  if (!wallet) {
    console.error((walletError as ServiceError).message);
    return;
  }

  console.log('run sync job for 30s ...');
  await sleep(30 * 1000);

  const [unlockedBalance, lockedBalance] = wallet.getBalance();
  const [walletBlockCount,, networkBlockCount] = wallet.getSyncStatus();
  console.log(`unlocked balance: ${unlockedBalance}, locked balance: ${lockedBalance}`);
  console.log(`wallet is ${networkBlockCount - walletBlockCount} blocks behind network height`);

  // check if we should create more subWallets
  const unclaimedSubWallets = await WalletManager.getSubWalletInfos(true);

  console.log(`unclaimed subWallets count: ${unclaimedSubWallets.length}`);
  const newSubWallets: string[] = [];

  if (unclaimedSubWallets.length < minUnclaimedSubWallets) {
    for (let i = 0; i < minUnclaimedSubWallets; i++) {
      const [address, error] = wallet.addSubWallet();

      if (!address) {
        console.error((error as WalletError));
      } else {
        console.log(`created new subWallet: ${address}`);
        newSubWallets.push(address);
      }
    }
  }

  const [, saveError] = await WalletManager.saveMasterWallet(wallet);

  if (saveError) {
    console.error(saveError.message);
    return;
  }

  if (newSubWallets.length > 0) {
    const batch = admin.firestore().batch();
    let newSubWalletCount = 0;

    newSubWallets.forEach(address => {
      const [publicSpendKey, privateSpendKey, err] = wallet.getSpendKeys(address);

      if (!publicSpendKey || !privateSpendKey || err) {
        console.error(err);
      } else {
        const doc = admin.firestore().collection('wallets/master/subWallets').doc();

        const subWalletInfo: SubWalletInfo = {
          id: doc.id,
          address: address,
          claimed: false,
          publicSpendKey: publicSpendKey,
          privateSpendKey: privateSpendKey
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

export async function updateDaemonInfo(): Promise<void> {

  // TODO: update daemon info: fee, selected node, etc...

  return Promise.resolve();
}
