import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { ServiceConfig } from 'functions/src/types';
import { AdminService } from 'src/app/providers/admin.service';
import { ServiceUser, UserRole } from 'shared/types';

@Component({
  selector: 'role-management',
  templateUrl: './role-management.component.html',
  styleUrls: ['./role-management.component.scss']
})
export class RoleManagementComponent implements OnInit {
  serviceConfig$: Observable<ServiceConfig | undefined> | undefined;
  admins$: Observable<ServiceUser[]> | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
    this.serviceConfig$ = this.adminService.getServiceConfig$();
    this.admins$ = this.adminService.getUsersByRole$('admin');
  }

  async assignUserRole(uid: string, role: UserRole): Promise<void> {
    try {
      await this.adminService.assignUserRole(uid, role);

      console.log('successfully assigned user role!');
    } catch (error) {
      console.error(error);
    }
  }
}
