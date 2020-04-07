import { WalletBackend } from "turtlecoin-wallet-backend";

export interface ServiceWallet {
  wallet: WalletBackend,
  serviceConfig: ServiceConfig
}

// TODO: see if this can be removed
// export interface WalletInfo {
//   location: string;
//   backupsDirectory: string;
//   lastSaveAt: number;
//   lastBackupAt: number;
// }

export interface SavedWallet {
  id: string;
  location: string;
  timestamp: number;
  checkpoint: boolean;
  lastSeenCheckpointId?: string;
  hasFile: boolean;
  isRewind: boolean;
  walletHeight: number;
  networkHeight: number;
}

export interface SavedWalletUpdate {
  hasFile?: boolean;
}

export interface WalletInfoUpdate {
  lastSaveAt?: number;
  lastBackupAt?: number;
}

export interface WalletSyncInfo {
  walletHeight: number,
  networkHeight: number;
  heightDelta: number;
}

export interface ServiceConfig {
  txConfirmations: number;
  txScanDepth: number;
  withdrawTimoutBlocks: number;
  waitForSyncTimeout: number;
  daemonHost: string;
  daemonPort: number;
  serviceHalted: boolean;
  inviteOnly: boolean;
  serviceCharge: number;
  adminEmail?: string;
}

export interface ServiceConfigUpdate {
  daemonHost?: string;
  daemonPort?: number;
  serviceHalted?: boolean;
  adminEmail?: string;
}

export interface ServiceNode {
  id: string;
  name: string;
  url: string;
  port: number;
  ssl: boolean;
  cache: boolean;
  fee: number;
  availability: number;
  online: boolean;
  version: string;
  priority: number;
  lastUpdateAt: number;
  lastDropAt: number;
}

export interface ServiceNodeUpdate {
  lastUpdateAt: number;
  name?: string;
  ssl?: boolean;
  cache?: boolean;
  fee?: number;
  availability?: number;
  online?: boolean;
  version?: string;
  lastDropAt?: number;
}

export interface NodeStatus {
  name:         string;
  url:          string;
  port:         number;
  ssl:          boolean;
  cache:        boolean;
  fee:          FeeInfo;
  availability: number;
  online:       boolean;
  version:      string;
  timestamp:    number;
}

export interface FeeInfo {
  address: string;
  amount:  number;
}

export interface AppInviteCode {
  code: string;
  createdAt: number;
  claimed: boolean;
}

export interface AppAuditResult {
  id: string,
  appId: string,
  timestamp: number,
  passed: boolean,
  missingDepositHashes?: string[];
  missingWithdrawalHashes?: string[];
  walletLockedBalance: number;
  walletUnlockedBalance: number;
  totalCredited: number,
  totalDebited: number,
  appBalance: number;
  logs?: string[];
}

export interface PrepareTransactionRequest {
  subWallet: string;
  sendAddress: string;
  amount: number;
  senderId?: string;
  paymentId?: string;
}

export interface StartWalletRequest {
  daemonHost: string;
  daemonPort: number;
}
