import { Component, OnInit, Input, Output, EventEmitter, OnDestroy } from '@angular/core';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Recipient } from 'shared/types';
import { Utilities } from 'src/utilities';
import { SubscriptionLike } from 'rxjs';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'recipient-form',
  templateUrl: './recipient-form.component.html',
  styleUrls: ['./recipient-form.component.scss']
})
export class RecipientFormComponent implements OnInit, OnDestroy {
  @Input() recipient: Recipient | undefined;
  @Input() removeable = false;

  @Output() recipientChange = new EventEmitter<Recipient>();
  @Output() remove = new EventEmitter<Recipient>();

  form: FormGroup;
  private receiverSubscription: SubscriptionLike;
  private amountSubscription: SubscriptionLike;

  constructor() {
    this.form = new FormGroup({
      receiverId: new FormControl('', Validators.compose([
        Validators.required
      ])),
      amount: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });

    this.receiverSubscription = this.form.controls.receiverId.valueChanges.subscribe(v => this.onUserIdChange(v));
    this.amountSubscription = this.form.controls.amount.valueChanges.subscribe(v => this.onAmountChange(v));
  }

  ngOnInit() {
  }

  ngOnDestroy(): void {
    this.receiverSubscription.unsubscribe();
    this.amountSubscription.unsubscribe();
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
