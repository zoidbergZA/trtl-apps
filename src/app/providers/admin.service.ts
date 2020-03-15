import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { ServiceStatus, Withdrawal, Deposit, Account, DaemonErrorEvent } from 'shared/types';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ServiceConfig, ServiceNode } from 'functions/src/types';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(
    private afs: AngularFirestore,
    private afFunctions: AngularFireFunctions) { }

  async getServiceStatus(): Promise<ServiceStatus | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('getServiceStatus')({ }).toPromise();
      return response as ServiceStatus;
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  async rewindServiceWallet(distance: number): Promise<number> {
    const response = await this.afFunctions.httpsCallable('rewindWallet')({
      distance
    }).toPromise();

    return response.walletHeight;
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

  getServiceConfig$(): Observable<ServiceConfig | undefined> {
    return this.afs.doc<ServiceConfig>('globals/config').valueChanges();
  }

  getServiceNodes$(): Observable<ServiceNode[]> {
    return this.afs
      .collection<ServiceNode>('nodes', ref => ref.orderBy('priority', 'desc'))
      .valueChanges();
  }

  getDaemonErrors$(): Observable<DaemonErrorEvent[]> {
    return this.afs.
      collection<DaemonErrorEvent>('admin/reports/daemonErrors', ref =>
        ref.orderBy('timestamp', 'desc')
        .limit(50))
      .valueChanges();
  }

  async getServiceChargeAccounts(): Promise<Account[] | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('getServiceChargeAccounts')({}).toPromise();

      return response as Account[];
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }
}
