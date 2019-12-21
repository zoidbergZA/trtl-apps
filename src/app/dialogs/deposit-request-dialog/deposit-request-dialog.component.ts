import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { TurtleApp } from 'shared/types';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'deposit-request-dialog',
  templateUrl: './deposit-request-dialog.component.html',
  styleUrls: ['./deposit-request-dialog.component.scss']
})
export class DepositRequestDialogComponent implements OnInit {

  app: TurtleApp;
  userId: string;

  constructor(
    public dialogRef: MatDialogRef<DepositRequestDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.app = data.app;
    this.userId = data.userId;
  }

    ngOnInit() {
    }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
