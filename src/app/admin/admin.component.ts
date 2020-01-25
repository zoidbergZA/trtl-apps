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
  fetchingStatus = false;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  async serviceStatusClick() {
    this.fetchingStatus = true;
    this.serviceStatus  = await this.adminService.getServiceStatus();
    this.fetchingStatus = false;
  }

  getSyncInfoString(syncInfo: [number, number, number]): string {
    const heightDelta = syncInfo[2] - syncInfo[0];
    return `wallet: ${syncInfo[0]}, daemon: ${syncInfo[1]}, network: ${syncInfo[2]}, height delta: ${heightDelta}`;
  }
}
