import { Component, OnInit } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { MatDialogRef } from '@angular/material';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'add-user-role-dialog',
  templateUrl: './add-user-role-dialog.component.html',
  styleUrls: ['./add-user-role-dialog.component.scss']
})
export class AddUserRoleDialogComponent implements OnInit {

  form: FormGroup;
  working = false;
  succeeded = false;
  errorMessage: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<AddUserRoleDialogComponent>,
    private adminService: AdminService
  ) {
    this.form = new FormGroup({
      email: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
  }

  onSubmit(result: any) {
    this.succeeded = false;
    this.errorMessage = undefined;
    this.working = true;

    this.adminService
      .assignUserRole(undefined, result.email, 'admin')
      .then(_ => this.succeeded = true)
      .catch(error => this.errorMessage = error.message)
      .finally(() => this.working = false);
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
