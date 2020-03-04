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
import { TurtleApp, AccountUpdate, Recipient, WithdrawalPreview } from '../../shared/types';
import { ServiceError } from './serviceError';

export const api = express();

// Automatically allow cross-origin requests
api.use(cors({ origin: true }));

api.post('/:appId/accounts/', async (req, res) => {
  try {
    return createAccount(req, res);
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

api.get('/:appId/accounts/:accountId', async (req, res) => {
  try {
    return getAppAccount(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.put('/:appId/accounts/:accountId/withdrawaddress', async (req, res) => {
  try {
    return setWithdrawAddress(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/:appId/deposits/:depositId', async (req, res) => {
  try {
    return getDeposit(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/:appId/deposits', async (req, res) => {
  try {
    return getDeposits(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.post('/:appId/prepared_withdrawals/', async (req, res) => {
  try {
    return createPreparedWithdrawal(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.post('/:appId/withdrawals/', async (req, res) => {
  try {
    return executePreparedWithdrawal(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/:appId/withdrawals/:withdrawalId', async (req, res) => {
  try {
    return getWithdrawal(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.post('/:appId/transfers/', async (req, res) => {
  try {
    return appTransfer(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

api.get('/:appId/transfers/:transferId', async (req, res) => {
  try {
    return getAccountTransfer(req, res);
  }
  catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

// api.get('/service/nodefee', async (req, res) => {
//   try {
//     return getNodeFee(req, res);
//   } catch (error) {
//     console.error(error);
//     res.status(500).send(new ServiceError('service/unknown-error'));
//   }
// });

api.get('/service/validateaddress', async (req, res) => {
  try {
    return validateAddress(req, res);
  } catch (error) {
    console.error(error);
    res.status(500).send(new ServiceError('service/unknown-error'));
  }
});

async function createAccount(request: any, response: any): Promise<void> {
  const [app, error] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((error));
    return;
  }

  const [account, createError] = await UsersModule.createAppAccount(app);

  if (!account) {
    response.status(500).send((createError));
  } else {
    response.status(200).send(account);
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

async function getAppAccount(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send(authError);
    return;
  }

  const accountId: string = request.params.accountId;

  if (!accountId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [appAccount, accountError] = await UsersModule.getAppAccount(app.appId, accountId);

  if (!appAccount) {
    response.status(500).send(accountError);
    return;
  }

  response.status(200).send(appAccount);
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

export async function getDeposits(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const accountId: string | undefined = request.query.accountId;
  let limit: number | undefined = request.query.limit;

  if (!accountId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  if (!limit) {
    limit = 25;
  } else {
    limit = Math.min(100, Math.max(1, limit));
  }

  const [deposits, serviceError] = await DepositsModule.getAccountDeposits(app.appId, accountId, limit);

  if (!deposits) {
    response.status(500).send(serviceError);
    return;
  }

  response.status(200).send(deposits);
}

export async function getWithdrawal(request: any, response: any): Promise<void> {
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

  const [withdrawal, serviceError] = await WithdrawalsModule.getWithdrawal(app.appId, withdrawalId);

  if (!withdrawal) {
    response.status(500).send(serviceError);
    return;
  }

  response.status(200).send(withdrawal);
}

async function appTransfer(request: any, response: any): Promise<void> {
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

  const [transfer, transferError] = await TransfersModule.accountTransfer(app, senderId, recipients);

  if (transfer) {
    response.status(200).send(transfer);
    return;
  } else if (transferError) {
    response.status(500).send(transferError);
    return;
  }
}

export async function getAccountTransfer(request: any, response: any): Promise<void> {
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

  const [transfer, serviceError] = await TransfersModule.getTransfer(app.appId, transferId);

  if (!transfer) {
    response.status(500).send(serviceError);
    return;
  }

  response.status(200).send(transfer);
}

async function createPreparedWithdrawal(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const accountId: string = request.body.accountId;
  const amount: number = Number(request.body.amount);
  let sendAddress: string | undefined = request.body.sendAddress;

  if (!Number.isInteger(amount)) {
    response.status(400).send(new ServiceError('request/invalid-params', 'amount must be in atomic units.'));
    return;
  }

  if (!accountId || amount <= 0) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [appAccount, accountError] = await UsersModule.getAppAccount(app.appId, accountId);

  if (!appAccount) {
    response.status(400).send((accountError));
    return;
  }

  if (!sendAddress) {
    sendAddress = appAccount.withdrawAddress;
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

  const [preparedWithdrawal, prepareError] = await WithdrawalsModule.createPreparedWithdrawal(
                                              app,
                                              appAccount,
                                              amount,
                                              sendAddress);

  if (!preparedWithdrawal) {
    response.status(500).send(prepareError);
    return;
  }

  // we remove some service-only information from the response
  const withdrawalPreview: WithdrawalPreview = {
    id:             preparedWithdrawal.id,
    appId:          preparedWithdrawal.appId,
    accountId:      preparedWithdrawal.accountId,
    timestamp:      preparedWithdrawal.timestamp,
    address:        preparedWithdrawal.address,
    amount:         preparedWithdrawal.amount,
    fees:            preparedWithdrawal.fees
  }

  response.status(200).send(withdrawalPreview);
}

async function executePreparedWithdrawal(request: any, response: any): Promise<void> {
  const [app, authError] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((authError));
    return;
  }

  const preparedWithdrawalId: string | undefined = request.body.preparedWithdrawalId;

  if (!preparedWithdrawalId) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [withdrawal, withdrawError] = await WithdrawalsModule.processPreparedWithdrawal(app.appId, preparedWithdrawalId);

  if (!withdrawal) {
    response.status(500).send((withdrawError));
    return;
  }

  response.status(200).send(withdrawal);
}

// async function getNodeFee(request: any, response: any): Promise<void> {
//   const [serviceConfig, ] = await ServiceModule.getServiceConfig();

//   if (!serviceConfig) {
//     response.status(500).send(new ServiceError('service/unknown-error'));
//     return;
//   }

//   response.status(200).send({ fee: serviceConfig.nodeFee });
// }

async function setWithdrawAddress(request: any, response: any): Promise<void> {
  const [app, error] = await authorizeAppRequest(request);

  if (!app) {
    response.status(401).send((error));
    return;
  }

  const accountId  = request.params.accountId;
  const address = request.body.address;

  if (!accountId || !address) {
    response.status(400).send(new ServiceError('request/invalid-params'));
    return;
  }

  const [appAccount, accountError] = await UsersModule.getAppAccount(app.appId, accountId);

  if (!appAccount) {
    response.status(400).send((accountError));
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

  const accountUpdateObject: AccountUpdate = {
    withdrawAddress: address
  }

  await admin.firestore().doc(`apps/${app.appId}/accounts/${accountId}`).update(accountUpdateObject);

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

  const fetchResults = await Promise.all([
    ServiceModule.getServiceConfig(),
    admin.firestore().doc(`apps/${appId}`).get()
  ]);

  const [serviceConfig, serviceError] = fetchResults[0];
  const appDoc = fetchResults[1];

  if (!serviceConfig) {
    return [undefined, serviceError];
  }

  if (serviceConfig.serviceHalted) {
    return [undefined, new ServiceError('service/service-halted')];
  }

  if (!appDoc.exists) {
    return [undefined, new ServiceError('app/app-not-found')];
  }

  const reqSecret = authHeader.split('Bearer ')[1];
  const turtleApp = appDoc.data() as TurtleApp;

  if (reqSecret === turtleApp.appSecret) {
    if (turtleApp.disabled) {
      return [undefined, new ServiceError('app/app-disabled')];
    } else {
      return [turtleApp, undefined];
    }
  }

  return [undefined, new ServiceError('request/unauthorized')];
}
