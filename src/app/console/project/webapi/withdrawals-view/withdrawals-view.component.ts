import { Component, OnInit, Input } from '@angular/core';
import { ConsoleService } from 'src/app/providers/console.service';
import { TurtleApp, Withdrawal } from 'shared/types';
import { Observable, BehaviorSubject, combineLatest } from 'rxjs';
import { DialogService } from 'src/app/providers/dialog.service';
import { tap, switchMap } from 'rxjs/operators';

@Component({
  selector: 'app-withdrawals-view',
  templateUrl: './withdrawals-view.component.html',
  styleUrls: ['./withdrawals-view.component.scss']
})
export class WithdrawalsViewComponent implements OnInit {

  readonly limitIncrement = 20;
  readonly maxLimit       = 200;

  _app: TurtleApp | undefined;
  withdrawals$: Observable<Withdrawal[] | undefined> | undefined;
  displayedColumns: string[] = ['withdrawalId', 'createdDate', 'amount', 'status'];

  withdrawalFilter$ = new BehaviorSubject<string>('');
  limit$            = new BehaviorSubject<number>(this.limitIncrement);
  fetching          = false;
  showLoadMore      = false;

  get app(): TurtleApp | undefined {
    return this._app;
  }

  @Input()
  set app(app: TurtleApp | undefined) {
    this._app = app;

    if (app) {
      this.fetching = true;

      this.withdrawals$ = combineLatest(
        this.withdrawalFilter$,
        this.limit$
      ).pipe(
        tap(_ => this.fetching = true),
        switchMap(([withdrawalId, limit]) => this.consoleService.getAppWithdrawals$(app.appId, limit, withdrawalId))
      ).pipe(
        tap(deposits => {
          const limit       = this.limit$.value;
          this.fetching     = false;
          this.showLoadMore = deposits.length === limit && limit < this.maxLimit;
        })
      );
    }
  }

  constructor(
    private dialogService: DialogService,
    private consoleService: ConsoleService
  ) { }

  ngOnInit() {
  }

  onSearchValueChanged(searchValue: string) {
    if (searchValue === undefined || searchValue === '') {
      this.withdrawalFilter$.next(searchValue);
    }
  }

  onSearchValueSubmitted(searchValue: string) {
    this.withdrawalFilter$.next(searchValue);
  }

  onDetailsClick(withdrawalId: string) {
    if (!this.app) {
      console.error(`no app input defined!`);
      return;
    }

    this.dialogService.openWithdrawalDetailsDialog(withdrawalId, this.app.appId);
  }

  accountDetailsClick(accountId: string) {
    if (!this.app) {
      console.error(`no app input defined!`);
      return;
    }

    this.dialogService.openAccountDetailsDialog(accountId, this.app);
  }
}
