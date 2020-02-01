import { Component, OnInit } from '@angular/core';
import { Deposit } from 'shared/types';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'deposit-inspector',
  templateUrl: './deposit-inspector.component.html',
  styleUrls: ['./deposit-inspector.component.scss']
})
export class DepositInspectorComponent implements OnInit {

  searchValue = '';
  fetching = false;
  history: Deposit[] | undefined;

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

    this.history = await this.adminService.getDepositHistory(this.searchValue);

    this.fetching = false;
  }
}
