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

export interface WalletStatus {
    started: boolean;
    uptime?: number;
    daemonHost?: string;
    daemonPort?: number;
    walletHeight?: number;
    networkHeight?: number;
}

export interface PreparedTxItem {
    hash: string;
    timestamp: number;
    senderId?: string;
}
