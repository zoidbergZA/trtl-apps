import { Component, OnInit, Inject } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'edit-string-dialog',
  templateUrl: './edit-string-dialog.component.html',
  styleUrls: ['./edit-string-dialog.component.scss']
})
export class EditStringDialogComponent implements OnInit {

  title: string;
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<EditStringDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any) {

    this.title = data.title || '';
    const stringValue = data.initialValue || '';

    this.form = new FormGroup({
      stringValue: new FormControl(stringValue, Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onCancelClick(): void {
    this.dialogRef.close();
  }

  onSubmit(data: any) {
    this.dialogRef.close(data.stringValue);
  }
}
