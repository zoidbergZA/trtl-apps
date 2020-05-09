# turtle-cloud-wallet-js

Run a turtlecoin-wallet-backend-js instance on Google App Engine.

## Setup

## new cloud project
Create a new project in the google cloud platform(GCP): https://cloud.google.com/

## Create storage bucket

Create a storage bucket with the name defined in the app-{env}.yaml environment variable `WALLETS_BUCKET`.

## get the code

Clone the repo

Install dependencies:

`npm install`

The `build` NPM script is used to trigger the TypeScript compilation
process. This step happens automatically when deploying to App Engine, but must
be performed manually when developing locally.

## Running locally

1. Perform the build step:

    npm run build

1. Run the completed program

    npm start

## Deploying to App Engine

Perform the build step:

    npm run build

gcloud configurations:

    run the following command to create a configuration

        gcloud init

    or select an existing configuration using

        gcloud config configurations activate my-config

    list existing configurations using

        gcloud config configurations list

    visit [for more information on configurations](https://cloud.google.com/sdk/gcloud/reference/config/configurations).

Deploy your app for a specific environment:

    gcloud app deploy app-development.yaml
    gcloud app deploy app-production.yaml


## Secure the endpoints

In the GCP menu, navigate to `Security -> Identity-Aware Proxy`. Turn on the `IAP` toggle for the App Engine resource.
Select the app engine resource and click `ADD MEMBER` on the right-hand menu. Give the new member the `IAP-secured Web App User` role. Members added here will have access to call the API enpoints.

## Set the wallet password in Firestore

Enable the GCP Firestore API in native mode. Create a firestore document in the location defined in the `ADMIN_DOC_LOCATION` app.yaml environment variable. Set the `walletPassword` field to the wallet's password.

## Copy a wallet binary file to the Starage bucket

To import an existing wallet file, copy the wallet binary file to the storage bucket created earlier. Make sure the wallet file has the same name as defined in the `WALLET_FILENAME` environment variable in the app.yaml file.
