import { Component, OnInit, Inject } from '@angular/core';
import { TurtleApp } from 'shared/types';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';
import { Utilities } from 'src/utilities';
import { ServiceError } from 'trtl-apps';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'withdraw-dialog',
  templateUrl: './withdraw-dialog.component.html',
  styleUrls: ['./withdraw-dialog.component.scss']
})
export class WithdrawDialogComponent implements OnInit {

  app: TurtleApp;
  accountId: string;
  busy = false;
  withdrawalId: string | undefined;
  errorMessage: string | undefined;
  form: FormGroup;
  amountAtomic: number | undefined;
  fee: number | undefined;
  total: number | undefined;

  constructor(
    public dialogRef: MatDialogRef<WithdrawDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService) {

    this.app = data.app;
    this.accountId = data.accountId;

    this.form = new FormGroup({
      amount: new FormControl('', Validators.compose([
        Validators.required
      ])),
      sendAddress: new FormControl()
    });

    this.form.controls.amount.valueChanges.subscribe(v => {
      this.amountAtomic = Utilities.getAtomicUnits(v);
      this.calculateTotal();
    });
  }

  ngOnInit() {
    this.consoleService.getFee(this.app.appId, this.app.appSecret).then(result => {
      this.fee = result[0];
      const feeError = result[1];

      this.calculateTotal();

      if (feeError !== undefined) {
        console.log((feeError as ServiceError).message);
      }
    }).catch(error => {
      console.log(`error service fetching fee: ${error}`);
    });
  }

  calculateTotal() {
    if (this.amountAtomic && this.fee) {
      this.total = this.amountAtomic + this.fee;
    } else {
      this.total = undefined;
    }
  }

  onAmountChange(amount: number) {
    console.log(amount);
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onSubmit(data: any) {
    this.withdrawalId = undefined;
    this.errorMessage = undefined;

    if (!this.app || !this.accountId) {
      this.errorMessage = 'Invalid input parameters.';
      return;
    }

    const amount: number = data.amount;
    const atomicUnits = Utilities.getAtomicUnits(amount);
    const sendAddress: string | undefined = data.sendAddress;

    if (!atomicUnits) {
      this.errorMessage = 'Invalid amount.';
      return;
    }

    this.busy = true;

    const [withdrawal, error] = await this.consoleService.withdraw(
                                  this.app.appId,
                                  this.app.appSecret,
                                  this.accountId,
                                  atomicUnits,
                                  sendAddress);

    this.busy = false;

    if (!withdrawal) {
      this.errorMessage = (error as ServiceError).message;
      return;
    }

    this.withdrawalId = withdrawal.id;
  }
}
