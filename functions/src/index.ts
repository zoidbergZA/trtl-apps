import * as express from 'express';
import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions';
import * as CronJobsModule from './modules/cronJobsModule';
import * as AppModule from './modules/appsModule';
import * as AccountsModule from './modules/accountsModule';
import * as ServiceAdmin from './modules/adminModule';
import * as DepositsModule from './modules/depositsModule';
import * as WithdrawalsModule from './modules/withdrawalsModule';
import * as Analytics from './modules/analyticsModule';
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
export const endpoints    = functions.https.onRequest(expressApp);

try {
  const appInsightsApiKey = functions.config().azure.appinsights;

  if (appInsightsApiKey) {
    Analytics.initAppInsights(appInsightsApiKey);
  }
} catch (error) {
  // no app insights API key set
}
