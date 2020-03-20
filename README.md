# TRTL Apps

This repository contains the source code for hosting the TRTL apps service. Visit [trtlapps.io](https://trtlapps.io) for more information.

## Service Setup

### Setup firebase prejects

#### Production project

1. Go to the [Firebase console](https://console.firebase.google.com) and create a new project.

2. Upgrade your firebase to the `blaze` plan, needed for making outbound function calls.

3. Enable the firebase authentication methods of your choice and add your authorized domains.

4. Enable Storage in the firebase console.

5. Create a firestore database in the console and select a region.

6. Enable Functions in the firebase console.

7. Enable Hosting in the firebase console.

8. Connect your custom domain to Hosting (optional).

#### development project (optional)

Repeat the steps above to create a firebase project for a development environment.

### Initialize firebase project

Clone the repo [https://github.com/turtlecoin/trtl-apps](https://github.com/turtlecoin/trtl-apps)

Open a terminal and navigate to the root directory of your project.

Run `npm install` in the *root* directory.
Run `npm install` in the */functions* directory.

Sign in to firebase `firebase login`

### Set firebase environment variables (production/development)

Read more about firebase environment variables:

[https://firebase.google.com/docs/functions/config-env](https://firebase.google.com/docs/functions/config-env)

[https://firebase.googleblog.com/2016/07/deploy-to-multiple-environments-with.html](https://firebase.googleblog.com/2016/07/deploy-to-multiple-environments-with.html)

### Set the functions environment variables

In the firebase console, download this project's service account private key JSON file by navigating to `Settings -> Service accounts`.

Set your service master password in the environment variables: `firebase functions:config:set serviceadmin.password="YOUR ADMIN PASSWORD"`
Pick a strong password and keep it safely backed up.

Set the following values in the environment variables:

`firebase functions:config:set appengine.project_id="YOUR APP ENGINE WALLET PROJECT ID"`

`firebase functions:config:set appengine.target_audience="YOUR Client ID"`

`firebase functions:config:set appengine.client_email="FROM THE ABOVE JSON FILE"`

`firebase functions:config:set appengine.private_key="FROM THE ABOVE JSON FILE"`

`firebase functions:config:set appengine.api_base="YOUR CLOUD WALLET ENDPOINTS BASE URL"` example: `https://app-engine-wallet.appspot.com`

`firebase functions:config:set appengine.wallets_bucket="WALLETS_BUCKET VARIABLE FROM *.yaml FILE"` choose the correct yaml file based on environment.

## Configure App Engine Wallet

Set up the App Engine service wallet using the project: [https://github.com/zoidbergZA/turtle-cloud-wallet-js](https://github.com/zoidbergZA/turtle-cloud-wallet-js) and add this firebase project's google service account as member. This will allow the firebase project access to the API. In the App Engine wallet project's GCP console, click `Security -> Identity-Aware Proxy`. In the context menu click `Edit OAuth client`. Copy the `Client ID` field for use in the next step.

Download the App Engine wallet project service account key file `IAM & admin -> Service Accounts`. Rename the file to `gcp_account_key.json`. Upload this json file to the firebase project's storage bucket in the root directory.

## Configure Angular Environment variables

Set the `environment.ts` and `environment.prod.ts` variables for your project's development and production environments. The Firebase config information can be found in the firebase `console -> project settings -> firebase SDK snippet -> config`.

## Development

### Updating firestore indexes

If you have updated the firestore index it is important to also add the changes to source control. In the firebase CLI, run `firebase firestore:indexes` to get the JSON, then overwrite the content of the `firestore.indexes.json` file in the root of the project folder.

### Updating firestore security rules

If you have updated the firestore rules it is important to also add the changes to source control. In the firebase console, copy the rules text and overwrite the content of the `firestore.rules` file in the root folder of the project.

### Updating OpenAPI documentation

Copy the `swagger.json` openAPI spec into the `src/docs/openapi` folder. Deploy to firebase hosting.

## Deploying

### Development environment

Build the angular project using `ng build`

Run the angular front-end locally using `ng serve`

Run `firebase use development` to switch to the development firebase project.

Run `firebase deploy` to deploy the project.

For a single command, you can also use the -P flag: `firebase deploy -P development`.

### Production environment

Build the angular project using `ng build --prod`

Run `firebase use production` to switch to the production firebase project.

Run `firebase deploy` to deploy the project.

For a single command, you can also use the -P flag: `firebase deploy -P production`.

## Bootstrap the service

In the firebase console *functions* tab, copy the URL of the bootstrap function.

Use a HTTP client to make a GET request to the bootstrap endpoint using the service admin password you created earlier. The password must be set in the 'x-trtl-apps-admin' request header. If the service bootstrapped succesfully, it will send a response containing the service's master wallet mnemonic seed. Save this in a safe place along with your service admin password, it is the only way to recover the service wallet!