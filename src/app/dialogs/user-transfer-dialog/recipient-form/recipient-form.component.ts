import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Recipient } from 'shared/types';
import { Utilities } from 'src/utilities';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'recipient-form',
  templateUrl: './recipient-form.component.html',
  styleUrls: ['./recipient-form.component.scss']
})
export class RecipientFormComponent implements OnInit {

  @Input() recipient: Recipient | undefined;
  @Input() removeable = false;

  @Output() recipientChange = new EventEmitter<Recipient>();
  @Output() remove = new EventEmitter<Recipient>();

  form: FormGroup;

  constructor() {
    this.form = new FormGroup({
      receiverId: new FormControl('', Validators.compose([
        Validators.required
      ])),
      amount: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });

    // TODO: unsubscribe
    this.form.controls.receiverId.valueChanges.subscribe(v => this.onUserIdChange(v));
    this.form.controls.amount.valueChanges.subscribe(v => this.onAmountChange(v));
  }

  ngOnInit() {
  }

  onRemoveClick() {
    if (this.recipient) {
      this.remove.emit(this.recipient);
    }
  }

  onUserIdChange(value: string) {
    if (this.recipient) {
      this.recipient.userId = value;
      this.recipientChange.emit(this.recipient);
    }
  }

  onAmountChange(value: number) {
    if (this.recipient) {
      const atomicUnits = Utilities.getAtomicUnits(value);
      this.recipient.amount = atomicUnits || 0;
      this.recipientChange.emit(this.recipient);
    }
  }
}
