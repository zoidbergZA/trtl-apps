import * as cors from 'cors';
import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as UsersModule from './usersModule';
import * as ServiceModule from './serviceModule';
import * as DepositsModule from './depositsModule';
import * as WithdrawalsModule from './withdrawalsModule';
import * as TransfersModule from './transfersModule';
import { validateAddress as backendValidateAddress } from 'turtlecoin-wallet-backend';
import { TurtleApp, AppUserUpdate, Recipient } from '../../shared/types';
import { ServiceError } from './serviceError';

export const api = express();

// Automatically allow cross-origin requests
api.use(cors({ origin: true }));

api.post('/:appId/users/', async (req, res) => {
  try {
    return createAppUser(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

// Don't expose this endpoint for now

// api.get('/:appId/users/', async (req, res) => {
//   try {
//     return getAppUsers(req, res);
//   }
//   catch (error) {
//     console.error(error);
//     res.status(500).send(new ServiceError('service/unknown-error'));
//   }
// });

api.get('/:appId/users/:userId', async (req, res) => {
  try {
    return getAppUser(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.put('/:appId/users/:userId/withdrawaddress', async (req, res) => {
  try {
    return setWithdrawAddress(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

// api.post('/:appId/deposits/', async (req, res) => {
//   try {
//     return createAppDepositRequest(req, res);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send(new ServiceError('service/unknown-error'));
//   }
// });

api.get('/:appId/deposits/:depositId', async (req, res) => {
  try {
    return getDeposit(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.post('/:appId/withdrawals/', async (req, res) => {
  try {
    return userWithdraw(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/:appId/withdrawals/:withdrawalId', async (req, res) => {
  try {
    return getWithdrawalRequest(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.post('/:appId/transfers/', async (req, res) => {
  try {
    return userTransfer(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/:appId/transfers/:transferId', async (req, res) => {
  try {
    return getUserTransfer(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/service/nodefee', async (req, res) => {
  try {
    return getNodeFee(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/service/validateaddress', async (req, res) => {
  try {
    return validateAddress(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

async function createAppUser(request: any, response: any): Promise<void> {
  const [app, error] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((error));
    return;
  }

  const [appUser, createError] = await UsersModule.createAppUser(app);

  if (!appUser) {
    response.status(500).send((createError));
  } else {
    response.status(200).send(appUser);
  }
}

// async function getAppUsers(request: any, response: any): Promise<void> {
//   const [app, authError] = await authorizeAppRequest(request);

//   if (!app) {
//     response.status(401).send((authError));
//     return;
//   }

//   const orderBy: UsersModule.UsersOrderBy = request.query.orderBy || 'createdAt';
//   const startAfter: string | undefined = request.query.startAfter;
//   let limit: number = request.query.limit || 25;

//   limit = clamp(limit, 1, 100);

//   const [users, error] = await UsersModule.getAppUsers(app.appId, orderBy, limit, startAfter);

//   if (!users) {
//     response.status(500).send(error)
//     return;
//   }

//   response.status(200).send(users);
// }

async function getAppUser(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send(authError);
    return;
  }

  const userId: string = request.params.userId;

  if (!userId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [appUser, userError] = await UsersModule.getAppUser(app.appId, userId);

  if (!appUser) {
    response.status(500).send(userError);
    return;
  }

  response.status(200).send(appUser);
}

export async function getDeposit(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const depositId: string = request.params.depositId;

  if (!depositId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [depositRequest, serviceError] = await DepositsModule.getDeposit(app.appId, depositId);

  if (!depositRequest) {
    response.status(500).send(serviceError);
    return;
  }

  response.status(200).send(depositRequest);
}

export async function getWithdrawalRequest(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const withdrawalId: string = request.params.withdrawalId;

  if (!withdrawalId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [withdrawRequest, serviceError] = await WithdrawalsModule.getWithdrawRequest(app.appId, withdrawalId);

  if (!withdrawRequest) {
    response.status(500).send(serviceError);
    return;
  }

  response.status(200).send(withdrawRequest);
}

async function userTransfer(request: any, response: any): Promise<void> {
  const [app, error] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((error));
    return;
  }

  const senderId: string | undefined = request.body.senderId;
  const recipients: Recipient[] | undefined = request.body.recipients

  if (!senderId || !recipients || recipients.length < 1) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [transfer, transferError] = await TransfersModule.userTransfer(app, senderId, recipients);

  if (transfer) {
    response.status(200).send(transfer);
    return;
  } else if (transferError) {
    response.status(500).send(transferError);
    return;
  }
}

export async function getUserTransfer(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const transferId: string = request.params.transferId;

  if (!transferId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [transfer, serviceError] = await TransfersModule.getUserTransfer(app.appId, transferId);

  if (!transfer) {
    response.status(500).send(serviceError);
    return;
  }

  response.status(200).send(transfer);
}

async function userWithdraw(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const userId: string = request.body.userId;
  const amount: number = Number(request.body.amount);
  let sendAddress: string | undefined = request.body.sendAddress;

  if (!Number.isInteger(amount)) {
    response.status(400).send(new ServiceError('request/invalid-params', 'amount must be in atomic units.'));
    return;
  }

  if (!userId || amount <= 0) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [appUser, userError] = await UsersModule.getAppUser(app.appId, userId);

  if (!appUser) {
    response.status(400).send((userError));
    return;
  }

  if (!sendAddress) {
    sendAddress = appUser.withdrawAddress;
  }

  if (!sendAddress) {
    response.status(400).send(new ServiceError('app/invalid-withdraw-address'));
    return;
  }

  const isValidAddress = backendValidateAddress(sendAddress, false);

  if (!isValidAddress) {
    response.status(400).send(new ServiceError('app/invalid-withdraw-address'));
    return;
  }

  const [withdrawRequest, withdrawError] = await WithdrawalsModule.processWithdrawRequest(
                                            app,
                                            appUser,
                                            amount,
                                            sendAddress);

  if (!withdrawRequest) {
    response.status(500).send((withdrawError));
    return;
  }

  response.status(200).send(withdrawRequest);
}

async function getNodeFee(request: any, response: any): Promise<void> {
  const [serviceConfig, ] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    response.status(500).send(new ServiceError('service/unknown-error'));
    return;
  }

  response.status(200).send({ fee: serviceConfig.nodeFee });
}

async function setWithdrawAddress(request: any, response: any): Promise<void> {
  const [app, error] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((error));
    return;
  }

  const userId  = request.params.userId;
  const address = request.body.address;

  if (!userId || !address) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [appUser, userError] = await UsersModule.getAppUser(app.appId, userId);

  if (!appUser) {
    response.status(400).send((userError));
    return;
  }

  /*
    We don't allow integrated addresses since we generate our own
    unique payment id's to track withdrawals
  */
  if (!backendValidateAddress(address, false)) {
    response.status(400).send(new ServiceError('app/invalid-withdraw-address', 'Invalid address provided.'));
    return;
  }

  const userUpdateObject: AppUserUpdate = {
    withdrawAddress: address
  }

  await admin.firestore().doc(`apps/${app.appId}/users/${userId}`).update(userUpdateObject);

  response.status(200).send({ withdrawAddress: address });
}

async function validateAddress(request: any, response: any): Promise<void> {
  const addressParam = request.query.address;
  const allowIntegratedParam = request.query.allowIntegrated;

  if (addressParam === undefined || allowIntegratedParam === undefined) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const allowIntegrated = !!(Boolean(JSON.parse(allowIntegratedParam)));
  const isValidAddress  = backendValidateAddress(addressParam, allowIntegrated);

  return response.status(200).send({ isValid: isValidAddress });
}

// async function createAppDepositRequest(request: any, response: any): Promise<void> {
//   const [app, error] = await authorizeAppRequest(request);

//   if (!app) {
//     response.status(401).send((error));
//     return;
//   }

//   if (app.appType !== 'appWallet') {
//     response.status(500).send(new ServiceError('app/invalid-app-type'));
//     return;
//   }

//   // request params
//   const userId: string = request.body.userId;
//   const amount: number = Number(request.body.amount);
//   const callbackUrl: string | undefined = request.body.callbackUrl;

//   if (!Number.isInteger(amount)) {
//     response.status(400).send(new ServiceError('request/invalid-params', 'amount must be in atomic units.'));
//     return;
//   }

//   if (!userId || !amount || amount <= 0) {
//     response.status(400).send(new ServiceError('request/invalid-params'));
//     return;
//   }

//   const [serviceConfig, ] = await ServiceModule.getServiceConfig();

//   if (!serviceConfig) {
//     response.status(500).send(new ServiceError('service/unknown-error'));
//     return;
//   }

//   const [appUser, userError] = await UsersModule.getAppUser(app.appId, userId);

//   if (!appUser) {
//     response.status(400).send((userError));
//     return;
//   }

//   const paymentId = generateRandomPaymentId();
//   let integratedAddress: string | undefined;

//   try {
//     integratedAddress = createIntegratedAddress(app.subWallet, paymentId);
//   } catch (error) {
//     console.error(error);
//   }

//   if (!integratedAddress) {
//     response.status(500).send(new ServiceError('service/unknown-error'));
//     return;
//   }

//   const expireDate = Date.now() + serviceConfig.txTimeout;
//   const depositDoc = admin.firestore().collection(`apps/${app.appId}/deposits`).doc();
//   const depositRequest = DepositsModule.createDeposit(
//                           depositDoc.id,
//                           app.appId,
//                           paymentId,
//                           app.subWallet,
//                           integratedAddress,
//                           userId,
//                           amount,
//                           expireDate,
//                           callbackUrl);

//   await depositDoc.set(depositRequest);
//   response.status(200).send(depositRequest);
// }

async function authorizeAppRequest(
  request: functions.https.Request): Promise<[TurtleApp | undefined, undefined | ServiceError]> {

  const appId = request.params.appId;

  if (!appId) {
    return [undefined, new ServiceError('request/invalid-params', 'missing [appId] request parameter.')];
  }

  let authHeader: string | null = null;

  if (typeof request.headers.authorization === "string") {
    authHeader = request.headers.authorization;
  } else {
    return [undefined, new ServiceError('request/unauthorized')];
  }

  if (!authHeader.startsWith('Bearer ')) {
    return [undefined, new ServiceError('request/unauthorized')];
  }

  const [serviceConfig, serviceError] = await ServiceModule.getServiceConfig();

  if (!serviceConfig) {
    return [undefined, serviceError];
  }

  if (serviceConfig.serviceHalted) {
    return [undefined, new ServiceError('service/service-halted')];
  }

  const reqSecret = authHeader.split('Bearer ')[1];
  const docSnapshot = await admin.firestore().doc(`apps/${appId}`).get();

  if (!docSnapshot.exists) {
    return [undefined, new ServiceError('app/app-not-found')];
  }

  const turtleApp = docSnapshot.data() as TurtleApp;

  if (reqSecret === turtleApp.appSecret) {
    if (turtleApp.disabled) {
      return [undefined, new ServiceError('app/app-disabled')];
    } else {
      return [turtleApp, undefined];
    }
  }

  return [undefined, new ServiceError('request/unauthorized')];
}
