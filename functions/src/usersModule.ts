import { ServiceError } from "./serviceError";
import { ServiceUser, AppUser, TurtleApp } from "../../shared/types";
import { generateRandomPaymentId } from './utils';
import { createIntegratedAddress } from 'turtlecoin-wallet-backend';
import { createCallback } from './webhookModule';
import * as AppModule from './appModule';
import * as admin from 'firebase-admin';

export type UsersOrderBy = 'userId' | 'createdAt' | 'balanceUnlocked';

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

export async function createAppUser(app: TurtleApp): Promise<[AppUser | undefined, undefined | ServiceError]> {
  const userDoc           = admin.firestore().collection(`apps/${app.appId}/users`).doc();
  const timestamp         = Date.now();
  const paymentId         = generateRandomPaymentId();
  const integratedAddress = createIntegratedAddress(app.subWallet, paymentId);

  const appUser: AppUser = {
    userId:             userDoc.id,
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
    await userDoc.create(appUser);
    return [appUser, undefined];
  } catch (error) {
    console.error(error);
    return [undefined, new ServiceError('app/create-user-failed')];
  }
}

export async function getAppUsers(
  appId: string,
  orderBy: UsersOrderBy,
  limit: number,
  startAfterUser?: string): Promise<[AppUser[] | undefined, undefined | ServiceError]> {

  try {
    let querySnapshot: FirebaseFirestore.QuerySnapshot;

    if (startAfterUser) {
      const startAfterDoc = await admin.firestore().doc(`apps/${appId}/users/${startAfterUser}`).get();

      if (!startAfterDoc.exists) {
        return [undefined, new ServiceError('app/user-not-found')];
      }

      querySnapshot = await admin.firestore().collection(`apps/${appId}/users`)
        .orderBy(orderBy)
        .startAfter(startAfterDoc)
        .limit(limit)
        .get();
      } else {
        querySnapshot = await admin.firestore().collection(`apps/${appId}/users`)
        .orderBy(orderBy)
        .limit(limit)
        .get();
      }
      const users = querySnapshot.docs.map(d => d.data() as AppUser);
    return [users, undefined];
  } catch (error) {
    return [undefined, new ServiceError('service/unknown-error')];
  }
}

export async function getAppUser(
  appId: string,
  userId: string): Promise<[AppUser | undefined, undefined | ServiceError]> {

  const userDoc = await admin.firestore().doc(`apps/${appId}/users/${userId}`).get();

  if (userDoc.exists) {
    const user = userDoc.data() as AppUser;
    return [user, undefined];
  } else {
    return [undefined, new ServiceError('app/user-not-found')];
  }

}

export async function processUserUpdated(
  oldState: AppUser,
  newState: AppUser): Promise<void> {

  const [app, error] = await AppModule.getApp(oldState.appId);

  if (!app) {
    console.log((error as ServiceError).message);
    return;
  }

  await createCallback(app, 'user/updated', newState);
}
