export interface ServiceUser {
  id: string;
  displayName: string;
  email?: string;
}

export interface AppUser {
  userId: string;
  appId: string;
  balanceUnlocked: number;
  balanceLocked: number;
  createdAt: number;
  deleted: boolean;
  paymentId: string;
  depositAddress: string;
  depositQrCode: string;
  withdrawAddress?: string;
  data?: any;
}

export interface AppUserUpdate {
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
  appId?: string;
  publicSpendKey: string;
  privateSpendKey: string;
}

export interface SubWalletInfoUpdate {
  claimed?: boolean;
  appId?: string;
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
}

export interface TurtleAppUpdate {
  webhook?: string;
  disabled?: boolean;
}

export interface UserTransfer {
  id: string;
  appId: string;
  senderId: string;
  recipients: Recipient[];
  timestamp: number;
}

export interface Recipient {
  userId: string;
  amount: number;
}

export type DepositStatus = 'confirming' | 'completed';

export interface Deposit {
  id: string;
  appId: string;
  userId: string;
  blockHeight: number;
  amount: number;
  depositAddress: string;
  paymentId: string;
  integratedAddress: string;
  status: DepositStatus;
  txHash?: string;
  createdDate: number;
  userCredited: boolean;
  lastUpdate: number;
  cancelled: boolean;
}

export interface AppDepositUpdate {
  lastUpdate: number;
  status?: DepositStatus;
  userCredited?: boolean;
  cancelled?: boolean;
  txHash?: string;
}

export type WithdrawStatus = 'confirming' | 'completed';

export interface Withdrawal {
  id: string;
  paymentId: string;
  appId: string;
  userId: string;
  amount: number;
  fee: number;
  address: string;
  timestamp: number;
  lastUpdate: number;
  status: WithdrawStatus;
  requestedAtBlock: number;
  blockHeight: number;
  failed: boolean;
  txHash?: string;
}

export interface WithdrawalUpdate {
  lastUpdate: number;
  status?: WithdrawStatus;
  blockHeight?: number;
  failed?: boolean;
  txHash?: string;
}
