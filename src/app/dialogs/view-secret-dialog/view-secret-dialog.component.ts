import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA, MatSnackBar, MatDialog } from '@angular/material';
import { ConfirmationDialogComponent } from '../confirmation-dialog/confirmation-dialog.component';
import { ConsoleService } from 'src/app/providers/console.service';

@Component({
  selector: 'view-secret-dialog',
  templateUrl: './view-secret-dialog.component.html',
  styleUrls: ['./view-secret-dialog.component.scss']
})
export class ViewSecretDialogComponent implements OnInit {

  appId: string;
  appSecret: string;
  busy = false;
  errorMessage: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<ViewSecretDialogComponent>,
    public dialog: MatDialog,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService,
    private snackbar: MatSnackBar) {

    this.appId = data.appId;
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

  async resetSecret() {
    this.busy = true;
    this.errorMessage = undefined;

    try {
      await this.consoleService.resetAppApiKey(this.appId);

      this.snackbar.open('API key successfully changed!', undefined, {
        duration: 6000,
      });

      this.dialogRef.close();
    } catch (error) {
      this.errorMessage = error;
    } finally {
      this.busy = false;
    }
  }
}
