import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'user-options',
  templateUrl: './user-options.component.html',
  styleUrls: ['./user-options.component.scss']
})
export class UserOptionsComponent implements OnInit {

  @Input() userId: string | undefined;

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
    if (!this.userId) {
      return;
    }

    this.depositRequest.emit(this.userId);
  }

  withdrawClick() {
    if (!this.userId) {
      return;
    }

    this.withdraw.emit(this.userId);
  }

  transferClick() {
    if (!this.userId) {
      return;
    }

    this.transfer.emit(this.userId);
  }

  setWithdrawAddressClick() {
    if (!this.userId) {
      return;
    }

    this.setWithdrawAddress.emit(this.userId);
  }

  deleteClick() {
    if (!this.userId) {
      return;
    }

    this.delete.emit(this.userId);
  }

  reactivateClick() {
    if (!this.userId) {
      return;
    }

    this.reactivate.emit(this.userId);
  }
}
