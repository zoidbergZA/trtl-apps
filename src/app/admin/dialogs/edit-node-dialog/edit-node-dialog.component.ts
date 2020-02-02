import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ServiceNode } from 'functions/src/types';

@Component({
  selector: 'edit-node-dialog',
  templateUrl: './edit-node-dialog.component.html',
  styleUrls: ['./edit-node-dialog.component.scss']
})
export class EditNodeDialogComponent implements OnInit {

  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<EditNodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ServiceNode) {

    // todo: populate initial form values
    console.log(data.name);

    this.form = new FormGroup({
      stringValue: new FormControl('kek', Validators.compose([
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
    // this.dialogRef.close(data.stringValue);
  }
}
