import { Component, OnInit, Inject } from '@angular/core';
import { TurtleApp, WithdrawalPreview } from 'shared/types';
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
  busyMessage = '';
  withdrawalPreview: WithdrawalPreview | undefined;
  withdrawalId: string | undefined;
  errorMessage: string | undefined;
  prepareForm: FormGroup;
  amountAtomic: number | undefined;
  total: number | undefined;

  constructor(
    public dialogRef: MatDialogRef<WithdrawDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService) {

    this.app = data.app;
    this.accountId = data.accountId;

    this.prepareForm = new FormGroup({
      amount: new FormControl('', Validators.compose([
        Validators.required
      ])),
      sendAddress: new FormControl()
    });

    this.prepareForm.controls.amount.valueChanges.subscribe(v => {
      this.amountAtomic = Utilities.getAtomicUnits(v);
    });
  }

  ngOnInit() {
  }

  calculateTotal(withdrawalPreview: WithdrawalPreview) {
    if (withdrawalPreview) {
      const fees = withdrawalPreview.fees;

      this.total = withdrawalPreview.amount + fees.txFee + fees.nodeFee + fees.serviceCharge;
    } else {
      this.total = undefined;
    }
  }

  // onAmountChange(amount: number) {
  //   console.log(amount);
  // }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onPrepareSubmit(data: any) {
    this.withdrawalPreview  = undefined;
    this.withdrawalId       = undefined;
    this.errorMessage       = undefined;

    this.busyMessage = 'preparing transaction...';
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

    const [withdrawalPreview, error] = await this.consoleService.prepareWithdrawal(
                                        this.app.appId,
                                        this.app.appSecret,
                                        this.accountId,
                                        atomicUnits,
                                        sendAddress);

    this.busy = false;

    if (!withdrawalPreview) {
      console.log(error);
      this.errorMessage = (error as ServiceError).message;
      return;
    }

    this.withdrawalPreview = withdrawalPreview;
    this.calculateTotal(withdrawalPreview);
  }

  async onSendWithdrawal() {
    if (!this.app || !this.accountId || !this.withdrawalPreview) {
      this.errorMessage = 'Invalid input parameters.';
      return;
    }

    this.withdrawalId = undefined;
    this.errorMessage = undefined;
    this.busy         = true;
    this.busyMessage  = 'sending transaction...';

    const [withdrawal, error] = await this.consoleService.withdraw(
      this.app.appId,
      this.app.appSecret,
      this.withdrawalPreview.id);

    this.busy = false;

    if (!withdrawal) {
    this.errorMessage = (error as ServiceError).message;
    return;
    }

    this.withdrawalId = withdrawal.id;
  }
}
