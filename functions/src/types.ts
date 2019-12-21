import { WalletBackend } from "turtlecoin-wallet-backend";

export interface ServiceWallet {
  wallet: WalletBackend,
  serviceConfig: ServiceConfig
}

export interface WalletInfo {
  location: string;
  backupsDirectory: string;
  lastSaveAt: number;
  lastBackupAt: number;
}

export interface WalletInfoUpdate {
  lastSaveAt?: number;
  lastBackupAt?: number;
}

export interface ServiceConfig {
  txConfirmations: number;
  txScanDepth: number;
  withdrawTimoutBlocks: number;
  waitForSyncTimeout: number;
  daemonHost: string;
  daemonPort: number;
  nodeFee: number;
  serviceHalted: boolean;
}

export interface NodeInfo {
  name: string;
  url: string;
  port: number;
  ssl: boolean;
  cache: boolean;
  priority: number;
}
