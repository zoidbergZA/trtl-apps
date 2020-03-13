import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'rewind-wallet-dialog',
  templateUrl: './rewind-wallet-dialog.component.html',
  styleUrls: ['./rewind-wallet-dialog.component.scss']
})
export class RewindWalletDialogComponent implements OnInit {

  form: FormGroup;
  working = false;
  succeeded = false;
  errorMessage: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<RewindWalletDialogComponent>,
    private adminService: AdminService
  ) {
    this.form = new FormGroup({
      distance: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onSubmit(result: any) {
    this.succeeded = false;
    this.errorMessage = undefined;
    this.working = true;

    this.adminService
      .rewindServiceWallet(result.distance)
      .then(_ => this.succeeded = true)
      .catch(error => this.errorMessage = error.message)
      .finally(() => this.working = false);
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
