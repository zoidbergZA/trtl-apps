import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { Withdrawal } from 'shared/types';

@Component({
  selector: 'withdrawal-inspector',
  templateUrl: './withdrawal-inspector.component.html',
  styleUrls: ['./withdrawal-inspector.component.scss']
})
export class WithdrawalInspectorComponent implements OnInit {
  fetching = false;
  history: Withdrawal[] | undefined;
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
    this.history = await this.adminService.getWithdrawalHistory(value);
    this.fetching = false;

    if (!this.history) {
      this.message = 'withdrawal not found.';
    }
  }
}
