import { Injectable } from '@angular/core';
import { AngularFireFunctions } from '@angular/fire/functions';

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  constructor(private afFunctions: AngularFireFunctions) { }

  async getServiceStatus(): Promise<any> {
    return this.afFunctions.httpsCallable('getServiceStatus')({ }).toPromise();
  }
}
