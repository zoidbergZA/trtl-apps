import { Component, OnInit, Inject } from '@angular/core';
import { TurtleApp } from 'shared/types';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ConsoleService } from 'src/app/providers/console.service';
import { ServiceError } from 'trtl-apps';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'set-address-dialog',
  templateUrl: './set-address-dialog.component.html',
  styleUrls: ['./set-address-dialog.component.scss']
})
export class SetAddressDialogComponent implements OnInit {

  app: TurtleApp;
  accountId: string;
  currentAddress: string | undefined;
  busy = false;
  errorMessage: string | undefined;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<SetAddressDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService) {

    this.app = data.app;
    this.accountId = data.accountId;

    this.form = new FormGroup({
      address: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onSubmit(data: any) {
    if (!this.app || !this.accountId) {
      console.error('input params not set! skipping set address.');
      return;
    }

    const address = data.address;
    this.errorMessage = undefined;
    this.busy = true;

    const [newAddress, error] = await this.consoleService.setWithdrawAddress(
                                      this.app.appId,
                                      this.app.appSecret,
                                      this.accountId,
                                      address);

    this.busy = false;

    if (!newAddress) {
      this.errorMessage = (error as ServiceError).message;
      return;
    }

    this.currentAddress = newAddress;
  }
}
