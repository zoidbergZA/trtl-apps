import { Component, OnInit } from '@angular/core';
import { Deposit } from 'shared/types';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'deposit-inspector',
  templateUrl: './deposit-inspector.component.html',
  styleUrls: ['./deposit-inspector.component.scss']
})
export class DepositInspectorComponent implements OnInit {
  fetching = false;
  history: Deposit[] | undefined;
  message: string | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  async onSearchClick(value: string) {
    if (this.fetching) {
      return;
    }

    this.history = undefined;
    this.message = undefined;

    this.fetching = true;
    this.history = await this.adminService.getDepositHistory(value);
    this.fetching = false;

    if (!this.history) {
      this.message = 'Deposit not found.';
    }
  }
}
