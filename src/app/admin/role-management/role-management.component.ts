import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ServiceConfig } from 'functions/src/types';
import { AdminService } from 'src/app/providers/admin.service';
import { ServiceUser, UserRole } from 'shared/types';
import { MatDialog } from '@angular/material';
import { AddUserRoleDialogComponent } from '../dialogs/add-user-role-dialog/add-user-role-dialog.component';
import { RemoveUserRoleDialogComponent } from '../dialogs/remove-user-role-dialog/remove-user-role-dialog.component';

@Component({
  selector: 'role-management',
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.scss']
})
export class RoleManagementComponent implements OnInit {
  serviceConfig$: Observable<ServiceConfig | undefined> | undefined;
  admins$: Observable<ServiceUser[]> | undefined;

  constructor(public dialog: MatDialog, private adminService: AdminService) { }

  ngOnInit() {
    this.serviceConfig$ = this.adminService.getServiceConfig$();
    this.admins$ = this.adminService.getUsersByRole$('admin');
  }

  onAddAdminClick() {
    this.dialog.open(AddUserRoleDialogComponent, {
      width: '800px'
    });
  }

  onRemoveAdminClick(user: ServiceUser) {
    this.dialog.open(RemoveUserRoleDialogComponent, {
      width: '800px',
      data: {
        user,
        role: 'admin'
      }
    });
  }
}
