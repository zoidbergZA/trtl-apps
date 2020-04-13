import { Injectable } from '@angular/core';
import { AngularFireAuth } from '@angular/fire/auth';
import { auth } from 'firebase/app';
import { Router } from '@angular/router';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  user: firebase.User | null = null;
  adminUser = false;

  constructor(
    public firebaseAuth: AngularFireAuth,
    private router: Router) {

    this.firebaseAuth.user.subscribe(async user => {
      this.user = user;

      if (user) {
        this.adminUser = false;

        const idTokenResult = await user.getIdTokenResult();

        if (idTokenResult) {
          if (!!idTokenResult.claims.admin) {
            this.adminUser = true;
          }
        }
      } else {
        this.adminUser = false;
      }
    });
  }

  getUid(): string | undefined {
    if (this.user) {
      return this.user.uid;
    } else {
      return undefined;
    }
  }

  createUserWithEmailAndPassword(email: string, password: string): Promise<auth.UserCredential> {
    return this.firebaseAuth.auth.createUserWithEmailAndPassword(email, password);
  }

  signInWithEmailAndPassword(email: string, password: string): Promise<any> {
    return this.firebaseAuth.auth.signInWithEmailAndPassword(email, password);
  }

  async sendVerificationEmail(): Promise<boolean> {
    const currentUser = this.firebaseAuth.auth.currentUser;

    if (!currentUser) {
      return false;
    }

    try {
      await currentUser.sendEmailVerification();
      return true;
    } catch (error) {
      return false;
    }
  }

  sendPasswordResetEmail(email: string): Promise<void> {
    return this.firebaseAuth.auth.sendPasswordResetEmail(email);
  }

  async signout(): Promise<void> {
    await this.firebaseAuth.auth.signOut();
    this.router.navigateByUrl('/home');
  }
}
