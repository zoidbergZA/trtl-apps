import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatSnackBar } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'set-webhook-dialog',
  templateUrl: './set-webhook-dialog.component.html',
  styleUrls: ['./set-webhook-dialog.component.scss']
})
export class SetWebhookDialogComponent implements OnInit {

  appId: string;
  initialValue: string;
  form: FormGroup;
  busy = false;
  errorMessage: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<SetWebhookDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService,
    private snackBar: MatSnackBar) {

    this.appId = data.appId;
    this.initialValue = data.initialValue || '';

    this.form = new FormGroup({
      url: new FormControl(this.initialValue, Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onCloseClick() {
    this.dialogRef.close();
  }

  onDeleteClick() {
    this.setWebhook(undefined);
  }

  onSubmit(data: any) {
    if (data.url === this.initialValue) {
      this.dialogRef.close();
      return;
    }

    this.setWebhook(data.url);
  }

  setWebhook(url: string | undefined) {
    this.errorMessage = undefined;
    this.busy = true;

    this.consoleService.setAppWebhook(this.appId, url).then(result => {
      if (!result.error) {
        if (result.webhook) {
          this.snackBar.open('Webhook successfully set.', undefined, { duration: 6000 });
        } else {
          this.snackBar.open('Webhook successfully deleted.', undefined, { duration: 6000 });
        }

        this.dialogRef.close();
      } else {
        this.errorMessage = result.message;
      }
    }).catch(e => {
      this.snackBar.open('An unknown error occured.', undefined, { duration: 6000 });
    }).finally(() => {
      this.busy = false;
    });
  }
}
