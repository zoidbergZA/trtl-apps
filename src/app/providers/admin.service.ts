import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Withdrawal, Deposit, Account, DaemonErrorEvent, WalletStatus } from 'shared/types';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { ServiceConfig, ServiceNode, SavedWallet } from 'functions/src/types';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(
    private afs: AngularFirestore,
    private afFunctions: AngularFireFunctions) { }

  async getWalletStatus(): Promise<WalletStatus[] | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('serviceAdmin-getWalletStatus')({ }).toPromise();
      return response as WalletStatus[];
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  async rewindServiceWallet(checkpoint: string): Promise<number> {
    const response = await this.afFunctions.httpsCallable('serviceAdmin-rewindWallet')({
      checkpoint
    }).toPromise();

    return response.walletHeight;
  }

  async getDepositHistory(depositId: string): Promise<Deposit[] | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('serviceAdmin-getDepositHistory')({
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
      const response = await this.afFunctions.httpsCallable('serviceAdmin-getWithdrawalHistory')({
        withdrawalId
      }).toPromise();

      return response as Withdrawal[];
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  async getServiceChargeAccounts(): Promise<Account[] | undefined> {
    try {
      const response = await this.afFunctions.httpsCallable('serviceAdmin-getServiceChargeAccounts')({}).toPromise();

      return response as Account[];
    } catch (error) {
      console.log(error);
      return undefined;
    }
  }

  getWalletSavesHistory$(limit: number): Observable<SavedWallet[]> {
    return this.afs
      .collection<SavedWallet>('wallets/master/saves', ref => ref
        .where('hasFile', '==', true)
        .orderBy('timestamp', 'desc')
        .limit(limit))
      .valueChanges();
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
}
