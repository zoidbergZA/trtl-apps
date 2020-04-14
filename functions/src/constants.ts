import { ServiceConfig, ServiceNode } from "./types";

export const defaultWalletLocation          = 'wallets/masterWallet.bin';
export const defaultWalletBackupsDirectory  = 'master_wallet_backups';
export const minUnclaimedSubWallets         = 50;
export const walletBackendUserAgentId       = 'trtl-apps';
export const availableNodesEndpoint         = 'https://blockapi.turtlepay.io/node/list/available';
export const serviceAdminRequestHeader      = 'x-trtl-apps-admin';
export const serviceChargesAccountId        = 'serviceCharges';
export const gcpWalletFilename              = 'masterWallet.bin';
export const gcpServiceAccountFilename      = 'gcp_account_key.json';

export const defaultServiceConfig: ServiceConfig = {
  daemonHost:             'blockapi.turtlepay.io',  // Default daemon to connect to
  daemonPort:             443,                      // Port number of the daemon
  txScanDepth:            2 * 60 * 24 * 7,          // Scan transactions up to aprox 7 days in the past
  txConfirmations:        6,                        // Amount of blocks needed to confirm a deposit/withdrawal
  withdrawTimoutBlocks:   2 * 60 * 24 * 4,          // Amount of blocks since a confirming withdrawal tx was not found before it is considered failed
  waitForSyncTimeout:     20000,                    // Max time is miliseconds for the master wallet to sync
  serviceHalted:          false,                    // If true, the service is disables and doesn't process transactions
  inviteOnly:             true,                     // An invitation code is required to create an app
  serviceCharge:          0,                        // Default service charge
  userAppLimit:           4                         // Maximum apps per user account
}

export const defaultNodes: ServiceNode[] = [
  {
    id: 'node1',
    name: 'TurtlePay Blockchain Cache - SSL',
    url: 'blockapi.turtlepay.io',
    port: 443,
    ssl: true,
    cache: true,
    fee: 0,
    availability: 0,
    online: false,
    version:'',
    priority: 100,
    lastUpdateAt: 0,
    lastDropAt: 0
  },
  {
    id: 'node2',
    name: 'TurtlePay Blockchain Cache',
    url: 'node.trtlpay.com',
    port: 80,
    ssl: false,
    cache: true,
    fee: 0,
    availability: 0,
    online: false,
    version:'',
    priority: 99,
    lastUpdateAt: 0,
    lastDropAt: 0
  },
  {
    id: 'node3',
    name: 'Bot.Tips Blockchain Cache',
    url: 'trtl.bot.tips',
    port: 80,
    ssl: false,
    cache: true,
    fee: 0,
    availability: 0,
    online: false,
    version:'',
    priority: 98,
    lastUpdateAt: 0,
    lastDropAt: 0
  }];
