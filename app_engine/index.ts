import * as express from "express";
import WB = require("turtlecoin-wallet-backend");
const  { Storage } = require("@google-cloud/storage");
const { Firestore } = require("@google-cloud/firestore");
import { PrepareTransactionRequest, StartWalletRequest, WalletStatus, PreparedTxItem } from "./types";

const storage = new Storage();
const firestore = new Firestore();

const PORT = Number(process.env.PORT) || 8080;
const WAIT_FOR_SYNC_TIMEOUT = 1000 * 10;
const PREPARED_TX_TIMEOUT = 1000 * 2 * 60;

const app = express();
app.use(express.json());

let wallet: WB.WalletBackend | undefined;
let preparedTxItems: PreparedTxItem[] | undefined;
let walletStartedAt = 0;
let isStartingWallet = false;

process.on("SIGTERM", async () => {
  console.log("Received SIGTERM. do cleanup...");

  const save = process.env.AUTOSAVE === "true";
  await stopWallet();
});

app.post("/start", async (req, res) => {
  const startWalletReq: StartWalletRequest = req.body;
  const [startedWallet, error] = await startWallet(startWalletReq);

  const result: WalletStatus = {
    started: startWallet !== undefined
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
    started: wallet !== undefined
  };

  if (wallet) {
    status.uptime = Date.now() - walletStartedAt;

    const [wHeight, , nHeight] = wallet.getSyncStatus();
    const daemonInfo = wallet.getDaemonConnectionInfo();

    status.walletHeight   = wHeight;
    status.networkHeight  = nHeight;
    status.daemonHost     = daemonInfo.host;
    status.daemonPort     = daemonInfo.port;
  }

  res.send(status);
});

app.post("/prepare_transaction", async (req, res) => {
  if (!wallet) {
    res.status(500).send("no wallet instance, call /start first.");
    return;
  }

  const synced = await waitForWalletSync(wallet, WAIT_FOR_SYNC_TIMEOUT);

  if (!synced) {
    res.status(500).send("wallet instance not synced, try again later...");
    return;
  }

  prunePreparedTransactions();

  const txRequest = req.body as PrepareTransactionRequest;

  // check if we should remove a previous senderID prepared tx (disabled for now)
  if (preparedTxItems && txRequest.senderId) {
    // const previousTxReq = preparedTxItems?.find(i => i.senderId === txRequest.senderId);

    // if (previousTxReq) {
    //   const index = preparedTxItems.indexOf(previousTxReq);

    //   if (index > -1) {
    //     preparedTxItems.splice(index, 1);
    //     console.log(`removed previous prepared tx for senderID: ${previousTxReq.senderId}`);
    //   }
    // }
  }

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

  if (sendResult.success && sendResult.transactionHash && preparedTxItems) {
    const preparedTxItem: PreparedTxItem = {
      hash:       sendResult.transactionHash,
      timestamp:  Date.now(),
      senderId:   txRequest.senderId
    };

    preparedTxItems.push(preparedTxItem);

    console.log(`added new prepared tx item with hash: ${preparedTxItem.hash}, total count: ${preparedTxItems.length}`);
  }

  res.send(sendResult);
});

app.post("/send", async (req, res) => {
  if (!wallet) {
    res.status(500).send("no wallet instance, call /start first.");
    return;
  }

  const txHash: string | undefined = req.body.preparedTxHash;

  if (!txHash) {
    res.status(400).send("missing txHash param.");
    return;
  }

  const synced = await waitForWalletSync(wallet, WAIT_FOR_SYNC_TIMEOUT);

  if (!synced) {
    res.status(500).send("wallet instance not synced, try again later...");
    return;
  }

  const sendResult = await wallet.sendPreparedTransaction(txHash);

  console.log(`send prepared tx hash [${txHash}] result succeeded? ${sendResult.success}`);

  if (!sendResult.success) {
    console.log(sendResult.error.toString());
  }

  res.send(sendResult);
});

app.listen(PORT, () => {
  console.log(`App listening on port ${PORT}`);
});

async function startWallet(startReq: StartWalletRequest)
  : Promise<[WB.WalletBackend | undefined, undefined | WB.WalletError]> {

  if (isStartingWallet) {
    return [undefined, new WB.WalletError(WB.WalletErrorCode.UNKNOWN_ERROR)];
  }

  console.log('starting wallet instance...');

  isStartingWallet = true;

  if (wallet) {
    await wallet.stop();
    wallet.removeAllListeners();
    wallet = undefined;
    preparedTxItems = [];
  }

  const walletPassword = await getWalletPassword();

  if (!walletPassword) {
    console.log("failed to get wallet password.");
    return [undefined, new WB.WalletError(WB.WalletErrorCode.UNKNOWN_ERROR)];
  }

  const bucketName = process.env.WALLETS_BUCKET;
  const fileLocation = `saved_wallets/${process.env.WALLET_FILENAME}`;

  console.log(`loading wallet from storage bucket [${bucketName}], file location [${fileLocation}]...`);

  try {
    const bucket          = storage.bucket(bucketName);
    const file            = bucket.file(fileLocation);
    const buffer          = await file.download();
    const walletString    = buffer.toString();
    const daemon          = new WB.Daemon(startReq.daemonHost, startReq.daemonPort);

    const [newInstance, error] = WB.WalletBackend.openWalletFromEncryptedString(
      daemon,
      walletString,
      walletPassword);

    if (newInstance) {
      wallet = newInstance;
      wallet.enableAutoOptimization(false);

      await wallet.start();

      isStartingWallet  = false;
      walletStartedAt   = Date.now();

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
  walletStartedAt = 0;
}

async function getWalletPassword(): Promise<string | null> {
  const adminDocRef = firestore.doc(process.env.ADMIN_DOC_LOCATION);
  const adminDoc    = await adminDocRef.get();

  if (!adminDoc.exists) {
    console.log("admin doc not found in Firestore.");
    return null;
  }

  return adminDoc.data().wallet_password;
}

function logWalletSyncStatus(walletInstance: WB.WalletBackend) {
  const [wHeight, , nHeight] = walletInstance.getSyncStatus();
  const heightDelta = nHeight - wHeight;

  console.log(`wallet sync status :: wallet [${wHeight}], network [${nHeight}], delta [${heightDelta}]`);
}

function prunePreparedTransactions() {
  if (!wallet || !preparedTxItems) {
    return;
  }

  if (preparedTxItems.length === 0) {
    return;
  }

  console.log(`pruning wallet prepared transactions, total prepared tx count: ${preparedTxItems.length}`);

  const cutoffTime = Date.now() - PREPARED_TX_TIMEOUT;

  while (true) {
    if (preparedTxItems.length === 0) {
      break;
    }

    if (preparedTxItems[0].timestamp <= cutoffTime) {
      const removed = wallet.deletePreparedTransaction(preparedTxItems[0].hash);

      if (removed) {
        console.log(`removed prepared tx with hash ${preparedTxItems[0].hash} from the wallet.`);
      }

      preparedTxItems.shift();
    } else {
      break;
    }
  }
}

export async function waitForWalletSync(walletInstance: WB.WalletBackend, timeoutMs: number): Promise<boolean> {
  const syncDetlaStart = getWalletSyncDelta(walletInstance);

  console.log(`wait for sync => sync delta at start: ${JSON.stringify(syncDetlaStart)}`);

  if (syncDetlaStart <= 0) {
    return Promise.resolve(true);
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

    console.log(`wait for sync => height delta after max wait time: ${syncDeltaAfterWait}`);
    return Promise.resolve(synced);
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
