import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';
import { ServiceStatus } from 'shared/types';

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
}
