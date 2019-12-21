import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'withdrawal-details-dialog',
  templateUrl: './withdrawal-details-dialog.component.html',
  styleUrls: ['./withdrawal-details-dialog.component.scss']
})
export class WithdrawalDetailsDialogComponent implements OnInit {

  appId: string;
  withdrawalId: string;

  constructor(
    public dialogRef: MatDialogRef<WithdrawalDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.appId = data.appId;
    this.withdrawalId = data.withdrawalId;
  }

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
