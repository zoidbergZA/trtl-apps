import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';
import { Account, TurtleApp } from 'shared/types';
import { Observable } from 'rxjs';

@Component({
  selector: 'account-details-dialog',
  templateUrl: './account-details-dialog.component.html',
  styleUrls: ['./account-details-dialog.component.scss']
})
export class AccountDetailsDialogComponent implements OnInit {

  app: TurtleApp;
  accountId: string;
  appAccount$: Observable<Account | undefined>;

  constructor(
    public dialogRef: MatDialogRef<AccountDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService
  ) {
    this.app          = data.app;
    this.accountId    = data.accountId;
    this.appAccount$  = this.consoleService.getAppAccount$(this.app.appId, this.accountId);
  }

  async ngOnInit() {
    // const [qrCode, err] = await this.consoleService.getQrCode(this.app.appId, this.app.appSecret, this.accountId, 120, 'turtle shop');

    // if (qrCode) {
    //   console.log(qrCode);
    // } else {
    //   console.log(err);
    // }
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
