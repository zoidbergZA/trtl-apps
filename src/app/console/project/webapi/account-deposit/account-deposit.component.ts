import { Component, OnInit, Input, EventEmitter, Output } from '@angular/core';
import { ConsoleService } from 'src/app/providers/console.service';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { TurtleApp } from 'shared/types';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'account-deposit',
  templateUrl: './account-deposit.component.html',
  styleUrls: ['./account-deposit.component.scss']
})
export class DepositComponent implements OnInit {

  @Input() app: TurtleApp | undefined;
  @Input() userId: string | undefined;

  @Output() dismiss = new EventEmitter<void>();

  busy = false;
  errorMessage: string | undefined;
  depositId: string | undefined;
  form: FormGroup;

  constructor(private consoleService: ConsoleService) {
    this.form = new FormGroup({
      amount: new FormControl('', Validators.compose([
        Validators.required
      ])),
      callbackUrl: new FormControl()
    });
  }

  ngOnInit() {
    this.depositId = undefined;
  }

  onCancelClick() {
    this.dismiss.emit();
  }

  onDoneClick() {
    this.dismiss.emit();
  }

  async onSubmit(data: any) {
    console.log('depricated');
  }
}
