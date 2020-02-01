import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { ServiceConfig } from 'functions/src/types';
import { Observable } from 'rxjs';

@Component({
  selector: 'config-management',
  templateUrl: './config-management.component.html',
  styleUrls: ['./config-management.component.scss']
})
export class ConfigManagementComponent implements OnInit {

  serviceConfig: Observable<ServiceConfig | undefined> | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
    this.serviceConfig = this.adminService.getServiceConfig$();
  }
}
