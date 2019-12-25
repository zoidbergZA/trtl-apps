import { ServiceError } from "./serviceError";
import { ServiceUser, Account, TurtleApp } from "../../shared/types";
import { generateRandomPaymentId } from './utils';
import { createIntegratedAddress } from 'turtlecoin-wallet-backend';
import * as admin from 'firebase-admin';

export type AccountsOrderBy = 'accountId' | 'createdAt' | 'balanceUnlocked';

export async function createServiceUser(userRecord: admin.auth.UserRecord): Promise<void> {
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

  await admin.firestore().doc(`serviceUsers/${id}`).set(serviceUser);
}

export async function createAppAccount(app: TurtleApp): Promise<[Account | undefined, undefined | ServiceError]> {
  const accountDoc        = admin.firestore().collection(`apps/${app.appId}/accounts`).doc();
  const timestamp         = Date.now();
  const paymentId         = generateRandomPaymentId();
  const integratedAddress = createIntegratedAddress(app.subWallet, paymentId);

  const account: Account = {
    id:                 accountDoc.id,
    appId:              app.appId,
    balanceLocked:      0,
    balanceUnlocked:    0,
    createdAt:          timestamp,
    deleted:            false,
    paymentId:          paymentId,
    depositAddress:     integratedAddress,
    depositQrCode:      `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=turtlecoin://${integratedAddress}`
  }

  try {
    await accountDoc.create(account);
    return [account, undefined];
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('app/create-account-failed')];
  }
}

export async function getAppAccounts(
  appId: string,
  orderBy: AccountsOrderBy,
  limit: number,
  startAfterAccount?: string): Promise<[Account[] | undefined, undefined | ServiceError]> {

  try {
    let querySnapshot: FirebaseFirestore.QuerySnapshot;

    if (startAfterAccount) {
      const startAfterDoc = await admin.firestore().doc(`apps/${appId}/accounts/${startAfterAccount}`).get();

      if (!startAfterDoc.exists) {
        return [undefined, new ServiceError('app/account-not-found')];
      }

      querySnapshot = await admin.firestore().collection(`apps/${appId}/accounts`)
        .orderBy(orderBy)
        .startAfter(startAfterDoc)
        .limit(limit)
        .get();
      } else {
        querySnapshot = await admin.firestore().collection(`apps/${appId}/accounts`)
        .orderBy(orderBy)
        .limit(limit)
        .get();
      }
      const accounts = querySnapshot.docs.map(d => d.data() as Account);
    return [accounts, undefined];
  } catch (error) {
    return [undefined, new ServiceError('service/unknown-error')];
  }
}

export async function getAppAccount(
  appId: string,
  accountId: string): Promise<[Account | undefined, undefined | ServiceError]> {

  const accountDoc = await admin.firestore().doc(`apps/${appId}/accounts/${accountId}`).get();

  if (accountDoc.exists) {
    const account = accountDoc.data() as Account;
    return [account, undefined];
  } else {
    return [undefined, new ServiceError('app/account-not-found')];
  }
}

// export async function processAccountUpdated(
//   oldState: Account,
//   newState: Account): Promise<void> {

//   const [app, error] = await AppModule.getApp(oldState.appId);

//   if (!app) {
//     console.log((error as ServiceError).message);
//     return;
//   }

//   await createCallback(app, 'user/updated', newState);
// }
