// This file can be replaced during build by using the `fileReplacements` array.
// `ng build --prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebase: {
    apiKey: 'AIzaSyAC4N0O_xX0mUyZ_oBygS7DW12mxwTOSiI',
    authDomain: 'trtlapps-development.firebaseapp.com',
    databaseURL: 'https://trtlapps-development.firebaseio.com',
    projectId: 'trtlapps-development',
    storageBucket: 'trtlapps-development.appspot.com',
    messagingSenderId: '238563466809',
    appId: '1:238563466809:web:b533caf8d4fd78079637e8'
  },
  apiBase: 'https://trtlapps-development.web.app/api',
  donationAddress: 'TRTLv2fdtVVDjWKueQ1aAETchiGVWkDvi1ATNgqZ3nKc7biCLm7KzLYeCzfS46mWYNRe8JaMPcTGWAR874kkN2zQ7Mt16J1vzcA',
  inviteOnly: true
};

/*
 * For easier debugging in development mode, you can import the following file
 * to ignore zone related error stack frames such as `zone.run`, `zoneDelegate.invokeTask`.
 *
 * This import should be commented out in production mode because it will have a negative impact
 * on performance if an error is thrown.
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
