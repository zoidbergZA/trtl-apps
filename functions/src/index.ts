import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as CronJobsModule from './modules/cronJobsModule';
import * as AppModule from './modules/appsModule';
import * as AccountsModule from './modules/accountsModule';
import * as ServiceAdmin from './modules/adminModule';
import * as DepositsModule from './modules/depositsModule';
import * as WithdrawalsModule from './modules/withdrawalsModule';
import { api as serviceApi } from './serviceApi';

admin.initializeApp();

const expressApp = express();
expressApp.use('/api', serviceApi);

export const serviceAdmin = ServiceAdmin;
export const scheduled    = CronJobsModule;
export const apps         = AppModule;
export const accounts     = AccountsModule;
export const deposits     = DepositsModule;
export const withdrawals  = WithdrawalsModule;

// TODO: remove temporary <any> cast below after github issue is resolved: https://github.com/firebase/firebase-functions/issues/587
export const endpoints    = functions.https.onRequest(<any>expressApp);
