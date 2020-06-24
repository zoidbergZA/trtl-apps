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
  node: ServiceNode | undefined;

  constructor(
    public dialogRef: MatDialogRef<EditNodeDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: ServiceNode | undefined,
    private adminService: AdminService
  ) {
    this.node = data;

    const url       = data ? data.url : '';
    const port      = data ? data.port : 0;
    const priority  = data ? data.priority : 0;

    this.form = new FormGroup({
      url: new FormControl(url, Validators.compose([
        Validators.required
      ])),
      port: new FormControl(port, Validators.compose([
        Validators.required
      ])),
      priority: new FormControl(priority, Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onCancelClick() {
    this.dialogRef.close();
  }

  async onSubmit(formData: ServiceNodeUpdate): Promise<void> {
    const { url, port, priority } = formData;

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

    if (this.node) {
      await this.updateNode(this.node, update);
    } else {
      await this.addNode(url, port, priority);
    }
  }

  async updateNode(node: ServiceNode, update: ServiceNodeUpdate): Promise<void> {
    try {
      await this.adminService.updateServiceNode(node.id, update);
      this.dialogRef.close();
    } catch (error) {
      this.error = error;
    } finally {
      this.busy = false;
    }
  }

  async addNode(url: string, port: number, priority: number): Promise<void> {
    try {
      await this.adminService.addServiceNode(url, port, priority);
      this.dialogRef.close();
    } catch (error) {
      this.error = error;
    } finally {
      this.busy = false;
    }
  }

  async removeNode(): Promise<void> {
    if (!this.node) {
      return;
    }

    try {
      await this.adminService.removeNode(this.node.id);
      this.dialogRef.close();
    } catch (error) {
      this.error = error;
    } finally {
      this.busy = false;
    }
  }
}
