import { Component, OnInit, Inject } from '@angular/core';
import { TurtleApp, Recipient, Transfer } from 'shared/types';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';
import { ServiceError } from 'trtl-apps';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'user-transfer-dialog',
  templateUrl: './user-transfer-dialog.component.html',
  styleUrls: ['./user-transfer-dialog.component.scss']
})
export class UserTransferDialogComponent implements OnInit {

  app: TurtleApp;
  accountId: string;
  isValid = false;
  busy = false;
  transfer: Transfer | undefined;
  errorMessage: string | undefined;
  recipients: Recipient[];

  constructor(
    public dialogRef: MatDialogRef<UserTransferDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService) {

    this.app = data.app;
    this.accountId = data.accountId;
    this.recipients = [{ accountId: '', amount: 0 }];
  }

  ngOnInit() {
  }

  onRecipientChange(_: Recipient) {
    this.recipients.forEach(r => {
      if (r.accountId === '') {
        this.isValid = false;
        return;
      }
      if (r.amount <= 0) {
        this.isValid = false;
        return;
      }

      this.isValid = true;
    });
  }

  onAddRecipientClick() {
    this.recipients.push({ accountId: '', amount: 0 });
  }

  removeRecipient(recipient: Recipient) {
    const index = this.recipients.indexOf(recipient, 0);

    if (index > -1) {
      this.recipients.splice(index, 1);
    }
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  async onSendClick() {
    this.transfer = undefined;
    this.errorMessage = undefined;

    if (!this.app || !this.accountId || this.recipients.length === 0) {
      this.errorMessage = 'Invalid input parameters.';
      return;
    }

    this.busy = true;
    let [newTransfer, error]: [Transfer | undefined, ServiceError | undefined] = [undefined, undefined];

    // note: we use both 'transfer' and 'transferMany' functions to test the node package.
    if (this.recipients.length === 1) {
      [newTransfer, error] = await this.consoleService.transfer(
                              this.app.appId,
                              this.app.appSecret,
                              this.accountId,
                              this.recipients[0].accountId,
                              this.recipients[0].amount);
    } else {
      [newTransfer, error] = await this.consoleService.transferMany(
                              this.app.appId,
                              this.app.appSecret,
                              this.accountId,
                              this.recipients);
    }

    this.busy = false;

    if (!newTransfer) {
      this.errorMessage = (error as ServiceError).message;
      return;
    }

    this.transfer = newTransfer;
  }
}
