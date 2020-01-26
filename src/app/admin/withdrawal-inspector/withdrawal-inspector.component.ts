import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { Withdrawal } from 'shared/types';

@Component({
  selector: 'withdrawal-inspector',
  templateUrl: './withdrawal-inspector.component.html',
  styleUrls: ['./withdrawal-inspector.component.scss']
})
export class WithdrawalInspectorComponent implements OnInit {

  searchValue = '';
  fetching = false;
  history: Withdrawal[] | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  onSearchValueChanged(searchValue: string) {
    this.searchValue = searchValue;
  }

  async onSearchClick() {
    if (this.fetching || this.searchValue === '') {
      return;
    }

    this.fetching = true;

    this.history = await this.adminService.getWithdrawalHistory(this.searchValue);

    this.fetching = false;
  }
}
