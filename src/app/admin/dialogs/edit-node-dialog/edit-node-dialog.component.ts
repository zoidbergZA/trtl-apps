import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { ServiceNode, ServiceNodeUpdate } from 'functions/src/types';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'edit-node-dialog',
  templateUrl: './edit-node-dialog.component.html',
  styleUrls: ['./edit-node-dialog.component.scss']
})
export class EditNodeDialogComponent implements OnInit {

  form: FormGroup;
  busy = false;
  error: string | undefined;
  node: ServiceNode;

  constructor(
    public dialogRef: MatDialogRef<EditNodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ServiceNode,
    private adminService: AdminService
  ) {
    this.node = data;

    this.form = new FormGroup({
      url: new FormControl(data.url, Validators.compose([
        Validators.required
      ])),
      port: new FormControl(data.port, Validators.compose([
        Validators.required
      ])),
      priority: new FormControl(data.priority, Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onCancelClick() {
    this.dialogRef.close();
  }

  async onSubmit(data: ServiceNodeUpdate) {
    const { url, port, priority } = data;

    if (!url || !port || !priority) {
      return;
    }

    this.busy = true;
    this.error = undefined;

    const update: ServiceNodeUpdate = {
      lastUpdateAt: Date.now(),
      url,
      port,
      priority
    };

    try {
      await this.adminService.updateServiceNode(this.node.id, update);
      this.dialogRef.close();
    } catch (error) {
      this.error = error;
    } finally {
      this.busy = false;
    }
  }
}
