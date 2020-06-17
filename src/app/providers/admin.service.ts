import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { Withdrawal, Deposit, Account, DaemonErrorEvent, WalletStatus, ServiceUser, UserRole, TurtleApp } from 'shared/types';
import { AngularFirestore } from '@angular/fire/firestore';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ServiceConfig, ServiceNode, SavedWallet, AppAuditResult } from 'functions/src/types';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(
    private firestore: AngularFirestore,
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

  async assignUserRole(uid: string | undefined, email: string | undefined, role: UserRole): Promise<void> {
    await this.afFunctions.httpsCallable('serviceAdmin-assignUserRole')({
      uid,
      email,
      role
    }).toPromise();
  }

  async removeUserRole(uid: string, role: UserRole): Promise<void> {
    await this.afFunctions.httpsCallable('serviceAdmin-removeUserRole')({
      uid,
      role
    }).toPromise();
  }

  async getApp(appId: string): Promise<TurtleApp | undefined> {
    const snapshot = await this.firestore.doc<TurtleApp>(`apps/${appId}`).get().toPromise();

    if (!snapshot.exists) {
      return undefined;
    }

    return snapshot.data() as TurtleApp;
  }

  getAppAudits(appId: string, limit: number = 30): Promise<AppAuditResult[]> {
    return this.firestore
      .collection<AppAuditResult>('appAudits', ref => ref
        .where('appId', '==', appId)
        .orderBy('timestamp', 'desc')
        .limit(limit))
      .get()
      .pipe(map(s => s.docs.map(d => d.data() as AppAuditResult)))
      .toPromise();
  }

  getWalletSavesHistory$(limit: number): Observable<SavedWallet[]> {
    return this.firestore
      .collection<SavedWallet>('wallets/master/saves', ref => ref
        .where('hasFile', '==', true)
        .orderBy('timestamp', 'desc')
        .limit(limit))
      .valueChanges();
  }

  getServiceConfig$(): Observable<ServiceConfig | undefined> {
    return this.firestore.doc<ServiceConfig>('globals/config').valueChanges();
  }

  getUsersByRole$(role: UserRole, limit: number = 50): Observable<ServiceUser[]> {
    return this.firestore
      .collection<ServiceUser>('serviceUsers', ref => ref
        .where('roles', 'array-contains', role)
        .limit(limit))
      .valueChanges();
  }

  getServiceNodes$(): Observable<ServiceNode[]> {
    return this.firestore
      .collection<ServiceNode>('nodes', ref => ref.orderBy('priority', 'desc'))
      .valueChanges();
  }

  getDaemonErrors$(): Observable<DaemonErrorEvent[]> {
    return this.firestore.
      collection<DaemonErrorEvent>('admin/reports/daemonErrors', ref =>
        ref.orderBy('timestamp', 'desc')
        .limit(50))
      .valueChanges();
  }
}
