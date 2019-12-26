import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'account-options',
  templateUrl: './account-options.component.html',
  styleUrls: ['./account-options.component.scss']
})
export class AccountOptionsComponent implements OnInit {

  @Input() accountId: string | undefined;

  @Output() depositRequest      = new EventEmitter<string>();
  @Output() withdraw            = new EventEmitter<string>();
  @Output() transfer            = new EventEmitter<string>();
  @Output() setWithdrawAddress  = new EventEmitter<string>();
  @Output() delete              = new EventEmitter<string>();
  @Output() reactivate          = new EventEmitter<string>();

  constructor() { }

  ngOnInit() {
  }

  depositClick() {
    if (!this.accountId) {
      return;
    }

    this.depositRequest.emit(this.accountId);
  }

  withdrawClick() {
    if (!this.accountId) {
      return;
    }

    this.withdraw.emit(this.accountId);
  }

  transferClick() {
    if (!this.accountId) {
      return;
    }

    this.transfer.emit(this.accountId);
  }

  setWithdrawAddressClick() {
    if (!this.accountId) {
      return;
    }

    this.setWithdrawAddress.emit(this.accountId);
  }

  deleteClick() {
    if (!this.accountId) {
      return;
    }

    this.delete.emit(this.accountId);
  }

  reactivateClick() {
    if (!this.accountId) {
      return;
    }

    this.reactivate.emit(this.accountId);
  }
}
