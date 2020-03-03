import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatSnackBar, MatDialog } from '@angular/material';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'view-secret-dialog',
  templateUrl: './view-secret-dialog.component.html',
  styleUrls: ['./view-secret-dialog.component.scss']
})
export class ViewSecretDialogComponent implements OnInit {

  appSecret: string;
  busy = false;
  errorMessage: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<ViewSecretDialogComponent>,
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any) {

    this.appSecret = data.appSecret;
  }

  ngOnInit() {
  }

  onResetClick() {
    this.errorMessage = undefined;

    const ref = this.dialog.open(ConfirmationDialogComponent, {
      width: '800px',
      data: {
        title: 'Reset API key',
        content: 'Are you sure you want to reset your app API key?'
      }
    });

    ref.afterClosed().subscribe(result => {
      if (result && result.confirmed) {
        this.resetSecret();
      }
    });
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }

  resetSecret() {
    this.busy = true;
  }
}
