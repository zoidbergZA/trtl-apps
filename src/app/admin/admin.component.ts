import { Component, OnInit } from '@angular/core';
import { AdminService } from '../providers/admin.service';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  async serviceStatusClick() {
    const status = await this.adminService.getServiceStatus();

    console.log(status);
  }
}
