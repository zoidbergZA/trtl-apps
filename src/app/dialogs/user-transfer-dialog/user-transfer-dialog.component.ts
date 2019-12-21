import { Component, OnInit, Inject } from '@angular/core';
import { TurtleApp, Recipient, UserTransfer } from 'shared/types';
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
  userId: string;
  isValid = false;
  busy = false;
  transfer: UserTransfer | undefined;
  errorMessage: string | undefined;
  recipients: Recipient[];

  constructor(
    public dialogRef: MatDialogRef<UserTransferDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService) {

    this.app = data.app;
    this.userId = data.userId;
    this.recipients = [{ userId: '', amount: 0 }];
  }

  ngOnInit() {
  }

  onRecipientChange(_: Recipient) {
    this.recipients.forEach(r => {
      if (r.userId === '') {
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
    this.recipients.push({ userId: '', amount: 0 });
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

    if (!this.app || !this.userId || this.recipients.length === 0) {
      this.errorMessage = 'Invalid input parameters.';
      return;
    }

    this.busy = true;
    let [newTransfer, error]: [UserTransfer | undefined, ServiceError | undefined] = [undefined, undefined];

    // note: we use both 'transfer' and 'transferMany' functions to test the node package.
    if (this.recipients.length === 1) {
      [newTransfer, error] = await this.consoleService.userTransfer(
                                      this.app.appId,
                                      this.app.appSecret,
                                      this.userId,
                                      this.recipients[0].userId,
                                      this.recipients[0].amount);
    } else {
      [newTransfer, error] = await this.consoleService.userTransferMany(
                                    this.app.appId,
                                    this.app.appSecret,
                                    this.userId,
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
