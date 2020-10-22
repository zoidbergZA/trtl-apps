import * as express from "express";
import WB = require("turtlecoin-wallet-backend");
import { PrepareTransactionRequest, ServiceWalletInfo, WalletStatus, PreparedTxItem, SendTransactionRequest } from "../shared/types";
import { Storage } from '@google-cloud/storage';
import { Firestore } from '@google-cloud/firestore';

const storage = new Storage();
const firestore = new Firestore();

const WALLET_INSTANCE_NAME = 'app engine';
const PORT = Number(process.env.PORT) || 8080;
const WAIT_FOR_SYNC_TIMEOUT = 1000 * 20;

const app = express();
app.use(express.json());

let wallet: WB.WalletBackend | undefined;
let walletFile: string | undefined;
let walletStartedAt = 0;
let isStartingWallet = false;

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. do cleanup...");

  await stopWallet();
});

app.post("/start", async (req, res) => {
  const serviceWalletInfo: ServiceWalletInfo | undefined = req.body;

  if (!serviceWalletInfo) {
    res.status(400).send({
      message: 'Invalid ServiceWalletInfo provided.'
    });
    return;
  }

  const [startedWallet, error] = await startWallet(serviceWalletInfo);

  const result: WalletStatus = {
    name: WALLET_INSTANCE_NAME,
    started: startedWallet !== undefined
  };

  if (startedWallet) {
    const [wHeight, nHeight] = startedWallet.getSyncStatus();
    const daemonInfo  = startedWallet.getDaemonConnectionInfo();

    result.uptime         = walletStartedAt - Date.now();
    result.walletHeight   = wHeight;
    result.networkHeight  = nHeight;
    result.daemonHost     = daemonInfo.host;
    result.daemonPort     = daemonInfo.port;
  }

  res.status(200).send(result);
});

app.get("/stop", async (req, res) => {
  await stopWallet();

  res.send("OK");
});

app.get("/status", (req, res) => {
  const status: WalletStatus = {
    name: WALLET_INSTANCE_NAME,
    started: wallet !== undefined
  };

  if (wallet) {
    status.uptime = Date.now() - walletStartedAt;

    const [wHeight, , nHeight] = wallet.getSyncStatus();
    const daemonInfo = wallet.getDaemonConnectionInfo();

    status.walletFile     = walletFile;
    status.walletHeight   = wHeight;
    status.networkHeight  = nHeight;
    status.daemonHost     = daemonInfo.host;
    status.daemonPort     = daemonInfo.port;
  }

  res.send(status);
});

app.post("/prepare_transaction", async (req, res) => {
  const txRequest: PrepareTransactionRequest | undefined = req.body;

  if (!txRequest) {
    res.status(400).send("Invalid prepare transaction request.");
    return;
  }

  const restartNeeded = await checkWalletRestartNeeded(txRequest.serviceWalletInfo);

  if (restartNeeded) {
    await startWallet(txRequest.serviceWalletInfo);
  }

  if (!wallet) {
    res.status(500).send("failed to start wallet instance.");
    return;
  }

  const synced = await waitForWalletSync(wallet, WAIT_FOR_SYNC_TIMEOUT);

  if (!synced) {
    res.status(500).send("wallet instance not synced, try again later...");
    return;
  }

  console.log(`sending transaction (not relaying to network)...`);

  const destinations: [string, number][] = [
    [txRequest.sendAddress, txRequest.amount],
  ];

  const sendResult = await wallet.sendTransactionAdvanced(
                      destinations,
                      undefined,
                      undefined,
                      txRequest.paymentId,
                      [txRequest.subWallet],
                      txRequest.subWallet,
                      false);

  console.log(`send result: ${JSON.stringify(sendResult)}`);
  res.send(sendResult);
});

app.post("/send", async (req, res) => {
  const txRequest: SendTransactionRequest | undefined = req.body;

  if (!txRequest) {
    res.status(400).send("Invalid transaction request.");
    return;
  }

  const restartNeeded = await checkWalletRestartNeeded(txRequest.serviceWalletInfo);

  if (restartNeeded) {
    // if wallet restarts, prepared txs are lost, we can return error here already
    res.status(500).send("wallet instance not synced, try again later...");
    return;
  }

  if (!wallet) {
    res.status(500).send("no wallet instance, call /start first.");
    return;
  }

  const synced = await waitForWalletSync(wallet, WAIT_FOR_SYNC_TIMEOUT);

  if (!synced) {
    res.status(500).send("wallet instance not synced, try again later...");
    return;
  }

  const sendResult = await wallet.sendPreparedTransaction(txRequest.preparedTxHash);

  console.log(`send prepared tx hash [${txRequest.preparedTxHash}] result succeeded? ${sendResult.success}`);

  if (!sendResult.success) {
    console.log(sendResult.error.toString());
  }

  res.send(sendResult);
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

async function checkWalletRestartNeeded(serviceWalletInfo: ServiceWalletInfo): Promise<boolean> {
  console.log('checking if wallet restart is needed...');

  if (!wallet) {
    console.log('no current wallet instance, restart needed...');
    return true;
  }

  if (walletFile !== serviceWalletInfo.filePath) {
    console.log(`wallet file ${walletFile} not the same as latest wallet file ${serviceWalletInfo.filePath}, restart needed...`);
    return true;
  }

  const daemonInfo = wallet.getDaemonConnectionInfo();

  if (daemonInfo.host !== serviceWalletInfo.daemonHost || daemonInfo.port !== serviceWalletInfo.daemonPort) {
    console.log('different daemon info detected, restart needed...');
    return true;
  }

  console.log(`wallet restart is not needed, using instance from file: ${walletFile}`);
  return false;
}

async function startWallet(serviceWalletInfo: ServiceWalletInfo)
  : Promise<[WB.WalletBackend | undefined, undefined | WB.WalletError]> {

  if (isStartingWallet) {
    console.log('Already starting a wallet instance, skipping start wallet call.');
    return [undefined, new WB.WalletError(WB.WalletErrorCode.UNKNOWN_ERROR)];
  }

  console.log('starting wallet instance...');

  isStartingWallet = true;

  if (wallet) {
    await wallet.stop();
    wallet.removeAllListeners();
    wallet = undefined;
    walletFile = undefined;
  }

  const walletPassword = await getWalletPassword();

  if (!walletPassword) {
    console.log("failed to get wallet password.");
    return [undefined, new WB.WalletError(WB.WalletErrorCode.UNKNOWN_ERROR)];
  }

  const bucketName = `${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com`;

  console.log(`loading wallet from storage bucket [${bucketName}], file location [${serviceWalletInfo.filePath}]...`);

  try {
    const bucket          = storage.bucket(bucketName);
    const file            = bucket.file(serviceWalletInfo.filePath);
    const buffer          = await file.download();
    const walletString    = buffer.toString();
    const daemon          = new WB.Daemon(serviceWalletInfo.daemonHost, serviceWalletInfo.daemonPort);

    const [newInstance, error] = await WB.WalletBackend.openWalletFromEncryptedString(
      daemon,
      walletString,
      walletPassword);

    if (newInstance) {
      wallet = newInstance;
      wallet.enableAutoOptimization(false);

      await wallet.start();

      isStartingWallet  = false;
      walletStartedAt   = Date.now();
      walletFile        = serviceWalletInfo.filePath;

      logWalletSyncStatus(wallet);

      return [wallet, undefined];
    } else {
      isStartingWallet = false;
      console.log(`error starting wallet: ${error}`);

      return [undefined, error];
    }

  } catch (error) {
    isStartingWallet = false;
    console.log(`error opening wallet file: ${error}`);

    return [undefined, new WB.WalletError(WB.WalletErrorCode.UNKNOWN_ERROR, `error opening wallet file: ${error}`)];
  }
}

async function stopWallet(): Promise<any> {
  if (!wallet) {
    return;
  }

  console.log(`stopping wallet...`);

  await wallet.stop();
  wallet.removeAllListeners();

  wallet = undefined;
  walletFile = undefined;
  walletStartedAt = 0;
}

async function getWalletPassword(): Promise<string | null> {
  const configPath = process.env.CONFIG_DOC_LOCATION;

  if (!configPath) {
    console.log('CONFIG_DOC_LOCATION env variable not defined.');
    return null;
  }

  const configDocRef = firestore.doc(configPath);
  const configDoc    = await configDocRef.get();

  if (!configDoc.exists) {
    console.log("config doc not found in Firestore.");
    return null;
  }

  const config = configDoc.data();

  if (config) {
    return config.wallet_password;
  }

  return null;
}

function logWalletSyncStatus(walletInstance: WB.WalletBackend) {
  const [wHeight, , nHeight] = walletInstance.getSyncStatus();
  const heightDelta = nHeight - wHeight;

  console.log(`wallet sync status :: wallet [${wHeight}], network [${nHeight}], delta [${heightDelta}]`);
}

// function prunePreparedTransactions() {
//   if (!wallet || !preparedTxItems) {
//     return;
//   }

//   if (preparedTxItems.length === 0) {
//     return;
//   }

//   console.log(`pruning wallet prepared transactions, total prepared tx count: ${preparedTxItems.length}`);

//   const cutoffTime = Date.now() - PREPARED_TX_TIMEOUT;

//   while (true) {
//     if (preparedTxItems.length === 0) {
//       break;
//     }

//     if (preparedTxItems[0].timestamp <= cutoffTime) {
//       const removed = wallet.deletePreparedTransaction(preparedTxItems[0].hash);

//       if (removed) {
//         console.log(`removed prepared tx with hash ${preparedTxItems[0].hash} from the wallet.`);
//       }

//       preparedTxItems.shift();
//     } else {
//       break;
//     }
//   }
// }

export async function waitForWalletSync(walletInstance: WB.WalletBackend, timeoutMs: number): Promise<boolean> {
  const syncDetlaStart = getWalletSyncDelta(walletInstance);

  console.log(`wait for sync => sync delta at start: ${JSON.stringify(syncDetlaStart)}`);

  if (syncDetlaStart <= 0) {
    return true;
  }

  const p1 = new Promise<boolean>((resolve, reject) => {
    let synced = false;
    walletInstance.on('sync', (walletHeight, networkHeight) => {
      if (!synced) {
        synced = true;
        console.log(`wallet synced! Wallet height: ${walletHeight}, Network height: ${networkHeight}`);
        resolve(true);
      }
    });
  });

  const p2 = sleep(timeoutMs).then(async (_: any) => {
    const syncDeltaAfterWait  = getWalletSyncDelta(walletInstance);
    const synced              = syncDeltaAfterWait <= 0;

    return synced;
  });

  return Promise.race([p1, p2]);
}

function getWalletSyncDelta(walletInstance: WB.WalletBackend): number {
  const [wHeight, , nHeight] = walletInstance.getSyncStatus();

  return nHeight - wHeight;
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}
