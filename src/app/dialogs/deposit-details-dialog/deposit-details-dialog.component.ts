import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  selector: 'app-deposit-details-dialog',
  templateUrl: './deposit-details-dialog.component.html',
  styleUrls: ['./deposit-details-dialog.component.scss']
})
export class DepositDetailsDialogComponent implements OnInit {

  appId: string;
  depositId: string;

  constructor(
    public dialogRef: MatDialogRef<DepositDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.appId = data.appId;
    this.depositId = data.depositId;
  }

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
