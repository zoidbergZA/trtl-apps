import { Component, OnInit, Input } from '@angular/core';
import { ConsoleService } from 'src/app/providers/console.service';
import { Observable } from 'rxjs';
import { Deposit } from 'shared/types';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'deposit-details',
  templateUrl: './deposit-details.component.html',
  styleUrls: ['./deposit-details.component.scss']
})
export class DepositDetailsComponent implements OnInit {

  @Input() appId: string | undefined;
  @Input() depositId: string | undefined;

  deposit$: Observable<Deposit | undefined> | undefined;

  constructor(private consoleService: ConsoleService) { }

  ngOnInit() {
    if (!this.appId || !this.depositId) {
      return;
    }

    this.deposit$ = this.consoleService.getAppDeposit$(this.appId, this.depositId);
  }
}
