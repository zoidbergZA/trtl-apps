import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { Account } from 'shared/types';

@Component({
  selector: 'service-charge-management',
  templateUrl: './service-charge-management.component.html',
  styleUrls: ['./service-charge-management.component.scss']
})
export class ServiceChargeManagementComponent implements OnInit {

  accounts: Account[] | undefined;

  constructor(private adminService: AdminService) { }

  async ngOnInit() {
    this.accounts = await this.adminService.getServiceChargeAccounts();
  }
}
