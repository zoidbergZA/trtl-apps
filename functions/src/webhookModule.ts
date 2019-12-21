import * as admin from 'firebase-admin';
import * as axios from 'axios';
import { TurtleApp } from '../../shared/types';

const retryIntervals: number[] = [
  1  * 60 * 1000,
  3  * 60 * 1000,
  10 * 60 * 1000,
  25 * 60 * 1000
];

export type CallbackCode =  'deposit/confirming'      |
                            'deposit/succeeded'       |
                            'deposit/cancelled'       |
                            'withdrawal/succeeded'    |
                            'withdrawal/failed'       |
                            'user/updated'

export interface Callback {
  code: CallbackCode;
  id: string;
  appId: string;
  timestamp: number;
  data: any;
  delivered: boolean;
  abandoned: boolean;
  attempts: number;
  nextAttemptAt: number;
  webhook?: string;
}

export interface CallbackUpdate {
  delivered?: boolean;
  abandoned?: boolean;
  attempts?: number;
  nextAttemptAt?: number;
}

export async function createCallback(app: TurtleApp, code: CallbackCode, data: any): Promise<void> {
  const callbackDoc = admin.firestore().collection(`apps/${app.appId}/callbacks`).doc();
  const delivered = (app.webhook === undefined) ? true : false;

  const callback: Callback = {
    code:           code,
    id:             callbackDoc.id,
    appId:          app.appId,
    timestamp:      Date.now(),
    data:           data,
    delivered:      delivered,
    abandoned:      false,
    attempts:       0,
    nextAttemptAt:  Number.MAX_SAFE_INTEGER
  }

  if (app.webhook) {
    callback.webhook = app.webhook;
  } else {
    callback.abandoned = true;
  }

  console.log(`create callback => appId: ${app.appId}, callbackId: ${callback.id}`);
  await callbackDoc.create(callback);

  // send cleaner version of the callback object
  const requestBody = {
    code: code,
    data: data
  }

  if (app.webhook) {
    try {
      const response = await axios.default.post(app.webhook, requestBody);
      console.log('webhook post response: ' + response.status);

      const updateObject: CallbackUpdate = {
        delivered: true,
        attempts: 1
      };

      await callbackDoc.update(updateObject);
    } catch (error) {
      console.log('error sending callback.');

      const updateObject: CallbackUpdate = {
        attempts: 1,
        nextAttemptAt: getNextAttemptDate(2)
      };

      await callbackDoc.update(updateObject);
    }
  }
}

export async function retryCallbacks(): Promise<void> {
  const snapshot = await admin.firestore()
                    .collectionGroup('callbacks')
                    .where('delivered', '==', false)
                    .where('abandoned', '==', false)
                    .where('nextAttemptAt', '<=', Date.now())
                    .get();

  console.log(`amount of callbacks to retry: ${snapshot.size}`);

  const callbacks = snapshot.docs.map(d => d.data() as Callback);
  const promises = callbacks.map(c => retryCallback(c));

  await Promise.all(promises);
}

async function retryCallback(callback: Callback): Promise<void> {
  if (!callback.webhook) {
    return;
  }

  // send cleaner version of the callback object
  const requestBody = {
    code: callback.code,
    data: callback.data
  }

  const callbackDoc = admin.firestore().doc(`apps/${callback.appId}/callbacks/${callback.id}`);
  const attemptNumber = callback.attempts + 1;

  try {
    const response = await axios.default.post(callback.webhook, requestBody);
    console.log('webhook post response: ' + response.status);

    const updateObject: CallbackUpdate = {
      delivered: true,
      attempts: attemptNumber
    };

    await callbackDoc.update(updateObject);
  } catch (error) {
    console.log('error sending callback.');

    const nextAttemptDate = getNextAttemptDate(attemptNumber + 1);

    const updateObject: CallbackUpdate = {
      attempts: attemptNumber
    };

    if (nextAttemptDate) {
      updateObject.nextAttemptAt = nextAttemptDate;
    } else {
      updateObject.abandoned = true;
    }

    await callbackDoc.update(updateObject);
  }
}

function getNextAttemptDate(nextAttemptNumber: number): number | undefined {
  if (nextAttemptNumber > retryIntervals.length) {
    return undefined;
  }

  const intervalIndex = Math.max(0, (nextAttemptNumber - 2));

  return Date.now() + retryIntervals[intervalIndex];
}
