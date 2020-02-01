import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { ServiceStatus, Withdrawal, Deposit } from 'shared/types';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(private afFunctions: AngularFireFunctions) { }

  async getServiceStatus(): Promise<ServiceStatus | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('getServiceStatus')({ }).toPromise();
      return response as ServiceStatus;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  async getDepositHistory(depositId: string): Promise<Deposit[] | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('getDepositHistory')({
        depositId
      }).toPromise();

      return response as Deposit[];
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  async getWithdrawalHistory(withdrawalId: string): Promise<Withdrawal[] | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('getWithdrawalHistory')({
        withdrawalId
      }).toPromise();

      return response as Withdrawal[];
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }
}
