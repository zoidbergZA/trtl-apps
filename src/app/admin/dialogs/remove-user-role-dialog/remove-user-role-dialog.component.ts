import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { AdminService } from 'src/app/providers/admin.service';
import { ServiceUser, UserRole } from 'shared/types';

@Component({
  selector: 'remove-user-role-dialog',
  templateUrl: './remove-user-role-dialog.component.html',
  styleUrls: ['./remove-user-role-dialog.component.scss']
})
export class RemoveUserRoleDialogComponent implements OnInit {

  user: ServiceUser;
  role: UserRole;
  working = false;
  succeeded = false;
  errorMessage: string | undefined;

  constructor(
    public dialogRef: MatDialogRef<RemoveUserRoleDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private adminService: AdminService
  ) {
    this.user = data.user;
    this.role = data.role;
  }

  ngOnInit() {
  }

  onConfirmClick() {
    this.succeeded = false;
    this.errorMessage = undefined;
    this.working = true;

    this.adminService
      .removeUserRole(this.user.id, this.role)
      .then(_ => this.succeeded = true)
      .catch(error => this.errorMessage = error.message)
      .finally(() => this.working = false);
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
