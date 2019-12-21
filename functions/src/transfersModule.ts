import { TurtleApp, UserTransfer, Recipient, AppUser, AppUserUpdate } from "../../shared/types";
import { ServiceError } from "./serviceError";
import * as admin from 'firebase-admin';

export async function userTransfer(
  app: TurtleApp,
  senderId: string,
  recipients: Recipient[]): Promise<[UserTransfer | undefined, undefined | ServiceError]> {

  const appId = app.appId;
  let transfer: UserTransfer | undefined;
  let transferError: ServiceError | undefined;

  if (recipients.find(r => r.userId === senderId)) {
    transferError = new ServiceError('transfer/invalid-recipient', 'Transfer to self not allowed.');
    return [undefined, transferError];
  }

  const distinctCount = Array.from(new Set(recipients.map(r => r.userId))).length;

  if (distinctCount !== recipients.length) {
    transferError = new ServiceError('transfer/invalid-recipient', 'Recipients must be unique.');
    return [undefined, transferError];
  }

  const amounts     = recipients.map(r => r.amount);
  const totalAmount = amounts.reduce((a, b) => a + b, 0);

  for (const amount of amounts) {
    if (!Number.isInteger(amount)) {
      transferError = new ServiceError('transfer/invalid-amount', 'Amount must be in atomic units.');
      return [undefined, transferError];
    }
    if (amount <= 0) {
      transferError = new ServiceError('transfer/invalid-amount', 'Amount must be > 0.');
      return [undefined, transferError];
    }
  }

  try {
    await admin.firestore().runTransaction(async (txn) => {
      const senderDocRef    = admin.firestore().doc(`apps/${appId}/users/${senderId}`);
      const senderDoc       = await txn.get(senderDocRef);
      const sender          = senderDoc.data() as AppUser;

      if (sender.balanceUnlocked < totalAmount) {
        transferError = new ServiceError('transfer/insufficient-funds');
        throw new Error(transferError.message);
      }

      const receiverDocRefs = recipients.map(r => {
        return admin.firestore().doc(`apps/${appId}/users/${r.userId}`);
      });

      const receiverDocs = await txn.getAll(...receiverDocRefs);

      receiverDocs.forEach(receiverDoc => {
        if (!receiverDoc.exists) {
          transferError = new ServiceError('transfer/invalid-recipient');
          throw new Error(transferError.message);
        }

        const receivingUser = receiverDoc.data() as AppUser;
        const recipient     = recipients.find(r => r.userId === receivingUser.userId);

        if (!recipient) {
          transferError = new ServiceError('transfer/invalid-recipient', 'Unable to find recipient.');
          throw new Error(transferError.message);
        }

        const receiverUpdate: AppUserUpdate = {
          balanceUnlocked : receivingUser.balanceUnlocked + recipient.amount
        };

        txn.update(receiverDoc.ref, receiverUpdate);
      });

      const senderUpdate: AppUserUpdate = {
        balanceUnlocked: sender.balanceUnlocked - totalAmount
      }

      txn.update(senderDocRef, senderUpdate);

      const transferDoc = admin.firestore().collection(`apps/${appId}/transfers`).doc();

      transfer = {
        id:         transferDoc.id,
        appId:      appId,
        senderId:   senderId,
        recipients: recipients,
        timestamp:  Date.now()
      }

      txn.create(transferDoc, transfer);
    });
  } catch (error) {
    console.warn(error);
  }

  if (transfer) {
    return [transfer, undefined];
  } else {
    if (transferError) {
      return [undefined, transferError];
    } else {
      return [undefined, new ServiceError('service/unknown-error')];
    }
  }
}

export async function getUserTransfer(
  appId: string,
  transferId: string): Promise<[UserTransfer | undefined, undefined | ServiceError]> {

  const transferDoc = await admin.firestore().doc(`apps/${appId}/transfers/${transferId}`).get();

  if (transferDoc.exists) {
    const transfer = transferDoc.data() as UserTransfer;
    return [transfer, undefined];
  } else {
    return [undefined, new ServiceError('app/transfer-not-found')];
  }
}
