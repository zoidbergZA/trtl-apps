import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AuthService } from 'src/app/providers/auth.service';
import { MatDialogRef } from '@angular/material';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'password-recovery-dialog',
  templateUrl: './password-recovery-dialog.component.html',
  styleUrls: ['./password-recovery-dialog.component.scss']
})
export class PasswordRecoveryDialogComponent implements OnInit {

  form: FormGroup;
  working = false;
  sent = false;
  errorMessage: string | undefined;

  constructor(private auth: AuthService, public dialogRef: MatDialogRef<PasswordRecoveryDialogComponent>) {
    this.form = new FormGroup({
      email: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onSubmit(result: any) {
    this.errorMessage = undefined;
    this.working = true;

    this.auth.sendPasswordResetEmail(result.email)
    .then(_ => {
      this.sent = true;
    })
    .catch(error => {
      this.errorMessage = error.message;
    })
    .finally(() => this.working = false);
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
