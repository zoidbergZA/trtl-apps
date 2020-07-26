export interface ServiceUser {
  id: string;
  displayName: string;
  email?: string;
  roles?: UserRole[];
}

export type UserRole = 'admin';

export interface Account {
  id: string;
  appId: string;
  balanceUnlocked: number;
  balanceLocked: number;
  createdAt: number;
  deleted: boolean;
  paymentId: string;
  spendSignaturePrefix: string;
  depositAddress: string;
  depositQrCode: string;
  withdrawAddress?: string;
  data?: any;
}

export interface AccountUpdate {
  balanceUnlocked?: number;
  balanceLocked?: number;
  withdrawAddress?: string;
  deleted?: boolean;
  data?: any;
}

export interface SubWalletInfo {
  id: string;
  address: string;
  claimed: boolean;
  deleted: boolean;
  createdAt: number;
  appId?: string;
  publicSpendKey: string;
  privateSpendKey: string;
}

export interface SubWalletInfoUpdate {
  claimed?: boolean;
  appId?: string;
  deleted?: boolean;
}

export interface TurtleApp {
  owner: string;
  name: string;
  appId: string;
  appSecret: string;
  subWallet: string;
  publicKey: string;
  webhook?: string;
  createdAt: number;
  disabled: boolean;
  lastAuditAt: number;
  lastAuditPassed: boolean;
}

export interface TurtleAppUpdate {
  webhook?: string;
  appSecret?: string;
  disabled?: boolean;
  lastAuditAt?: number;
  lastAuditPassed?: boolean;
}

export interface Transfer {
  id: string;
  appId: string;
  senderId: string;
  recipients: Recipient[];
  timestamp: number;
}

export interface Recipient {
  accountId: string;
  amount: number;
}

export type DepositStatus = 'confirming' | 'completed';

export interface Deposit {
  id: string;
  appId: string;
  accountId: string;
  blockHeight: number;
  amount: number;
  depositAddress: string;
  paymentId: string;
  integratedAddress: string;
  status: DepositStatus;
  txHash?: string;
  createdDate: number;
  accountCredited: boolean;
  lastUpdate: number;
  cancelled: boolean;
}

export interface AppDepositUpdate {
  lastUpdate: number;
  status?: DepositStatus;
  accountCredited?: boolean;
  cancelled?: boolean;
  txHash?: string;
}

export type PreparedWithdrawalStatus = 'ready' | 'expired' | 'sent';

export interface PreparedWithdrawal {
  id: string;
  appId: string;
  accountId: string;
  preparedTxJson: string;
  timestamp: number;
  lastUpdate: number;
  status: PreparedWithdrawalStatus;
  address: string;
  amount: number;
  fees: Fees;
  paymentId: string;
  txHash: string;
}

export interface Fees {
  txFee: number;
  nodeFee: number;
  serviceFee: number;
}

export interface PreparedWithdrawalUpdate {
  lastUpdate: number;
  status?: PreparedWithdrawalStatus;
  txHash?: string;
  preparedTxJson?: string;
}

// this type is the same as PreparedWithdrawal without some of the service-only information
export interface WithdrawalPreview {
  id: string;
  appId: string;
  accountId: string;
  timestamp: number;
  address: string;
  amount: number;
  fees: Fees;
  txHash: string;
}

export type WithdrawStatus = 'pending' | 'confirming' | 'faulty' | 'lost' | 'completed';

export interface Withdrawal {
  id: string;
  paymentId: string;
  appId: string;
  accountId: string;
  amount: number;
  fees: Fees;
  serviceChargeId?: string;
  accountDebited: boolean;
  address: string;
  timestamp: number;
  lastUpdate: number;
  status: WithdrawStatus;
  requestedAtBlock: number;
  blockHeight: number;
  failed: boolean;
  preparedWithdrawalId: string;
  txHash: string;
  daemonErrorCode?: number;
  retries: number;
}

export interface WithdrawalUpdate {
  lastUpdate: number;
  status?: WithdrawStatus;
  requestedAtBlock?: number;
  blockHeight?: number;
  failed?: boolean;
  daemonErrorCode?: number;
  accountDebited?: boolean;
  txHash?: string;
  retries?: number;
}

export type ServiceChargeType = 'withdrawal';
export type ServiceChargeStatus = 'confirming' | 'processing' | 'completed';

export interface ServiceCharge {
  id: string;
  appId: string;
  type: ServiceChargeType;
  timestamp: number;
  amount: number;
  chargedAccountId: string;
  lastUpdate: number;
  cancelled: boolean;
  status: ServiceChargeStatus;
  withdrawalId?: string;
}

export interface ServiceChargeUpdate {
  lastUpdate: number;
  cancelled?: boolean;
  status?: ServiceChargeStatus;
}

export interface WalletStatus {
  name: string;
  started: boolean;
  uptime?: number;
  daemonHost?: string;
  daemonPort?: number;
  walletHeight?: number;
  networkHeight?: number;
  error?: string;
}

export interface DaemonErrorEvent {
  id: string;
  timestamp: number;
  appId: string;
  accountId: string;
  preparedWithdrawalId: string;
  daemonErrorCode: number;
  nodeUrl: string;
  port: number;
}

export interface GoogleServiceAccountKey {
  type: string;
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  auth_uri: string;
  token_uri: string;
  auth_provider_x509_cert_url: string;
  client_x509_cert_url: string;
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

export interface PreparedTxItem {
  hash: string;
  timestamp: number;
  senderId?: string;
}
