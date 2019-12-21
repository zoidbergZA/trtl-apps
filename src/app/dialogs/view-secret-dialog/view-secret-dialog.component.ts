import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatSnackBar } from '@angular/material';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'view-secret-dialog',
  templateUrl: './view-secret-dialog.component.html',
  styleUrls: ['./view-secret-dialog.component.scss']
})
export class ViewSecretDialogComponent implements OnInit {

  appSecret: string;

  constructor(
    public dialogRef: MatDialogRef<ViewSecretDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {

    this.appSecret = data.appSecret;
  }

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
