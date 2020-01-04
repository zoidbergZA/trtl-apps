export type ServiceErrorCode =  'service/unknown-error'               |
                                'service/not-initialized'             |
                                'service/service-halted'              |
                                'service/master-wallet-sync-failed'   |
                                'service/no-unclaimed-subwallets'     |
                                'service/create-app-failed'           |
                                'service/master-wallet-info'          |
                                'service/master-wallet-file'          |

                                'app/invalid-app-name'                |
                                'app/app-not-found'                   |
                                'app/app-disabled'                    |
                                'app/create-account-failed'           |
                                'app/account-not-found'               |
                                'app/invalid-withdraw-address'        |
                                'app/deposit-not-found'               |
                                'app/prepared-withdrawal-not-found'   |
                                'app/invalid-prepared-withdrawal'     |
                                'app/withdrawal-not-found'            |
                                'app/transfer-not-found'              |

                                'request/unauthorized'                |
                                'request/invalid-params'              |

                                'transfer/invalid-amount'             |
                                'transfer/invalid-recipient'          |
                                'transfer/insufficient-funds'


export class ServiceError {
  public readonly errorCode: ServiceErrorCode;
  public readonly message: string;

  constructor(errorCode: ServiceErrorCode, customMessage?: string) {
    this.errorCode = errorCode;

    if (customMessage) {
      this.message = customMessage;
    } else {
      this.message = this.getErrorMessage(errorCode);
    }
  }

  getErrorMessage(errorCode: ServiceErrorCode): string {
    switch (errorCode) {
      case 'service/not-initialized':
        return 'Service not initialized';
      case 'service/service-halted':
        return 'Service is currently unavailable, please try again later.'
      case 'service/master-wallet-sync-failed':
        return 'Failed to sync service master wallet.';
      case 'service/no-unclaimed-subwallets':
        return 'No unclaimed subWallets available.';
      case 'service/create-app-failed':
        return 'An error occured while creating the app.';
      case 'service/master-wallet-info':
        return 'Failed to retrieve master wallet info.';
      case 'service/master-wallet-file':
          return 'Failed to open master wallet file.';

      case 'app/invalid-app-name':
        return 'Invalid app name provided.'
      case 'app/app-not-found':
        return 'App not found.';
      case 'app/app-disabled':
        return 'App is currently disabled.';
      case 'app/create-account-failed':
        return 'Failed to create app account.'
      case 'app/account-not-found':
        return 'App account not found';
      case 'app/invalid-withdraw-address':
        return 'Invalid send address.';
      case 'app/deposit-not-found':
        return 'Deposit not found';
      case 'app/withdrawal-not-found':
        return 'Withdrawal request not found';
      case 'app/prepared-withdrawal-not-found':
        return 'Prepared withdrawal not found';
      case 'app/invalid-prepared-withdrawal':
        return 'Invalid prepared withdrawal';
      case 'app/transfer-not-found':
        return 'Transfer not found';

      case 'request/invalid-params':
        return 'Invalid request parameters provided';
      case 'request/unauthorized':
        return 'Unauthorized request.'

      case 'transfer/insufficient-funds':
        return 'Account has insufficient funds for transfer.'
      case 'transfer/invalid-amount':
        return 'Invalid amout specified in transfer request.'
      case 'transfer/invalid-recipient':
        return 'Invalid transfer recipient.'

      default:
        return 'An unknown error has occured.';
    }
  }
}
