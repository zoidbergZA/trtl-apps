import { Component, OnInit, Input } from '@angular/core';
import { ConsoleService } from 'src/app/providers/console.service';
import { Observable } from 'rxjs';
import { Withdrawal } from 'shared/types';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'withdrawal-details',
  templateUrl: './withdrawal-details.component.html',
  styleUrls: ['./withdrawal-details.component.scss']
})
export class WithdrawalDetailsComponent implements OnInit {

  @Input() appId: string | undefined;
  @Input() withdrawalId: string | undefined;

  withdrawal$: Observable<Withdrawal | undefined> | undefined;

  constructor(private consoleService: ConsoleService) { }

  ngOnInit() {
    if (!this.appId || !this.withdrawalId) {
      return;
    }

    this.withdrawal$ = this.consoleService.getAppWithdrawal$(this.appId, this.withdrawalId);
  }
}
