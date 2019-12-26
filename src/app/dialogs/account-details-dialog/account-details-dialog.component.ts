import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';
import { Account, TurtleApp } from 'shared/types';
import { Observable } from 'rxjs';

@Component({
  // tslint:disable-next-line:component-selector
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

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
