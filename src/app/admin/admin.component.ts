import { Component, OnInit } from '@angular/core';
import { AdminService } from '../providers/admin.service';
import { ServiceStatus } from 'shared/types';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {

  serviceStatus: ServiceStatus | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  async serviceStatusClick() {
    this.serviceStatus = await this.adminService.getServiceStatus();
    console.log(this.serviceStatus);
  }
}
