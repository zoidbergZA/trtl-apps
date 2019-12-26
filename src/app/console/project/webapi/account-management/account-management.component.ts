import { Component, OnInit, Input } from '@angular/core';
import { TurtleApp, Account } from 'shared/types';
import { ConsoleService } from 'src/app/providers/console.service';
import { MatSnackBar } from '@angular/material';
import { Observable, BehaviorSubject } from 'rxjs';
import { ServiceError } from 'trtl-apps';
import { DialogService } from 'src/app/providers/dialog.service';
import { combineLatest } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'account-management',
  templateUrl: './account-management.component.html',
  styleUrls: ['./account-management.component.scss']
})
export class AccountManagementComponent implements OnInit {

  get app(): TurtleApp | undefined {
    return this._app;
  }

  @Input()
  set app(app: TurtleApp | undefined) {
    this._app = app;

    if (app) {
      this.fetching = true;

      this.appAccounts$ = combineLatest(
        this.accountFilter$,
        this.limit$
      ).pipe(
        tap(_ => this.fetching = true),
        switchMap(([accountId, limit]) => this.consoleService.getAppAccounts$(app.appId, limit, accountId))
      ).pipe(
        tap(accounts => {
          const limit       = this.limit$.value;
          this.fetching     = false;
          this.showLoadMore = accounts.length === limit && limit < this.maxLimit;
        })
      );
    }
  }

  readonly limitIncrement = 20;
  readonly maxLimit       = 200;

  // tslint:disable-next-line:variable-name
  _app: TurtleApp | undefined;
  accountFilter$ = new BehaviorSubject<string>('');
  appAccounts$: Observable<Account[]> | undefined;
  limit$ = new BehaviorSubject<number>(this.limitIncrement);
  displayedColumns: string[] = ['accountId', 'createdAt', 'balance', 'options'];

  searchValue     = '';
  creatingAccount = false;
  fetching        = false;
  showLoadMore    = false;

  constructor(
    private consoleService: ConsoleService,
    private dialogService: DialogService,
    private snackBar: MatSnackBar) { }

  ngOnInit() {
  }

  createAppAccount() {
    if (!this.app) {
      return;
    }

    this.creatingAccount = true;

    this.consoleService.createAppAccount(this.app.appId, this.app.appSecret).then(([account, error]) => {
      if (account) {
        this.snackBar.open(`new app account created: ${account.id}`, undefined, { duration: 6000 });
      } else {
        console.log((error as ServiceError).message);
        this.snackBar.open('failed to create app account.', undefined, { duration: 6000 });
      }
      this.creatingAccount = false;
    }).catch(_ => {
      console.log('error creating app account.');
      this.creatingAccount = false;
    });
  }

  onSearchValueChanged(searchValue: string) {
    this.searchValue = searchValue;
    this.accountFilter$.next(searchValue);
  }

  accountDetailsClick(accountId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openAccountDetailsDialog(accountId, this.app);
  }

  loadMoreClick() {
    this.limit$.next(this.limit$.value + this.limitIncrement);
  }

  accountWithdraw(accountId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openAccountWithdrawDialog(accountId, this.app);
  }

  transfer(accountId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openTransferDialog(accountId, this.app);
  }

  setWithdrawAddress(accountId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openWithdrawAddressDialog(accountId, this.app);
  }

  accountDelete(accountId: string) {
    console.log('handle account delete...');
  }

  accountReactivate(accountId: string) {
    console.log('handle account reactivate...');
  }
}
