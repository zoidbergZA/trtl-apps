import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ViewSecretDialogComponent } from '../view-secret-dialog/view-secret-dialog.component';

@Component({
  selector: 'confirmation-dialog',
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss']
})
export class ConfirmationDialogComponent implements OnInit {

  title: string | undefined;
  content: string | undefined;
  matchString: string | undefined;
  currentString = '';

  constructor(
    public dialogRef: MatDialogRef<ViewSecretDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any
  ) {
    this.title = data.title;
    this.content = data.content;
    this.matchString = data.matchString;
  }

  ngOnInit() {
  }

  onInputChange(event: any) {
    this.currentString = event.target.value;
  }

  onConfirmClick() {
    this.dialogRef.close({ confirmed: true });
  }

  onCancelClick() {
    this.dialogRef.close();
  }
}
