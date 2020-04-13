import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as ServiceModule from './serviceModule';
import * as WalletManager from '../walletManager';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as Analytics from './analyticsModule';
import * as Constants from '../constants';
import { ServiceError } from '../serviceError';
import { ServiceCharge } from '../../../shared/types';
import { SavedWallet } from '../types';

const cors = require('cors')({ origin: true });

export const getServiceStatus = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const [status, error] = await ServiceModule.getServiceStatus();

  if (!status) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return status;
});

export const rewindWallet = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const checkpointId: string | undefined = data.checkpoint;

  if (!checkpointId) {
    throw new functions.https.HttpsError('invalid-argument', 'missing distance parameter');
  }

  const snapshot = await admin.firestore().doc(`wallets/master/saves/${checkpointId}`).get();

  if (!snapshot.exists) {
    throw new functions.https.HttpsError('not-found', `unable to find checkpoint: ${checkpointId}.`);
  }

  const previousCheckpoint = snapshot.data() as SavedWallet;

  const [newCheckpoint, rewindError] = await WalletManager.rewindToCheckpoint(previousCheckpoint);

  if (!newCheckpoint) {
    throw new functions.https.HttpsError('internal', (rewindError as ServiceError).message);
  }

  return newCheckpoint;
});

export const getDepositHistory = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const depositId: string | undefined = data.depositId;

  if (!depositId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [history, error] = await DepositsModule.getDepositHistory(depositId);

  if (!history) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return history;
});

export const getWithdrawalHistory = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const withdrawalId: string | undefined = data.withdrawalId;

  if (!withdrawalId) {
    throw new functions.https.HttpsError('invalid-argument', 'invalid parameters provided.');
  }

  const [history, error] = await WithdrawalsModule.getWithdrawalHistory(withdrawalId);

  if (!history) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return history;
});

export const getServiceChargeAccounts = functions.https.onCall(async (data, context) => {
  const isAdmin = await isAdminUserCheck(context);

  if (!isAdmin) {
    throw new functions.https.HttpsError('failed-precondition', 'The function must be called by admin user.');
  }

  const [accounts, error] = await ServiceModule.getServiceChargeAccounts();

  if (!accounts) {
    const err = error as ServiceError;
    throw new functions.https.HttpsError('internal', err.message);
  }

  return accounts;
});

export const giveUserAdminRights = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    if (!validateAdminHeader(request)) {
      response.status(403).send('unauthorized request.');
      return;
    }

    const userId: string | undefined = request.query.uid;

    if (!userId) {
      response.status(400).send('bad request');
      return;
    }

    return ServiceModule.giveUserAdminRights(userId).then(succeeded => {
      response.status(200).send({ succeeded: succeeded });
    }).catch(error => {
      console.log(error);
      response.status(500).send({ error: error });
    });
  });
});

export const createInvitationsBatch = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    if (!validateAdminHeader(request)) {
      response.status(403).send('unauthorized request.');
      return;
    }

    return ServiceModule.createInvitationsBatch(10).then(result => {
      const invitesCount = result[0];
      const serviceError = result[1];

      if (invitesCount) {
        response.status(200).send(`created ${invitesCount} new invitations.`);
      } else {
        response.status(500).send(serviceError as ServiceError);
      }
    }).catch(error => {
      console.log(error);
      response.status(500).send(new ServiceError('service/unknown-error'));
    });
  });
});

export const bootstrap = functions.https.onRequest(async (request, response) => {
  cors(request, response, () => {
    if (!validateAdminHeader(request)) {
      response.status(403).send('unauthorized request.');
      return;
    }

    return ServiceModule.boostrapService().then(result => {
      const mnemonicSeed = result[0];
      const serviceError = result[1];

      if (mnemonicSeed) {
        response.status(200).send({
          error: false,
          mnemonicSeed: mnemonicSeed
        });
      } else {
        response.status(405).send((serviceError as ServiceError).message);
      }
    }).catch(error => {
      response.status(405).send(error);
    });
  });
});

exports.onServiceChargeUpdated = functions.firestore.document(`/apps/{appId}/serviceCharges/{chargeId}`)
.onUpdate(async (change, context) => {
  const charge = change.after.data() as ServiceCharge;

  if (charge.status === 'completed' && !charge.cancelled) {
    Analytics.trackMetric('successful service charge', charge.amount * 0.01);
  }
});

async function isAdminUserCheck(context: functions.https.CallableContext): Promise<boolean> {
  if (!context.auth) {
    return false;
  }

  try {
    const user    = await admin.auth().getUser(context.auth.uid);
    const claims  = user.customClaims as any;

    if (claims && !!claims.admin) {
      return true;
    }
  } catch (error) {
    console.log(error);
  }

  return false;
}

function validateAdminHeader(request: functions.https.Request): boolean {
  const adminSignature = request.get(Constants.serviceAdminRequestHeader);

  return adminSignature === functions.config().serviceadmin.password;
}
