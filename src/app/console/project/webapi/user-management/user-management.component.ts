import { Component, OnInit, Input } from '@angular/core';
import { TurtleApp, AppUser } from 'shared/types';
import { ConsoleService } from 'src/app/providers/console.service';
import { MatSnackBar } from '@angular/material';
import { Observable, BehaviorSubject } from 'rxjs';
import { ServiceError } from 'trtl-apps';
import { DialogService } from 'src/app/providers/dialog.service';
import { combineLatest } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'app-user-management',
  templateUrl: './user-management.component.html',
  styleUrls: ['./user-management.component.scss']
})
export class UserManagementComponent implements OnInit {

  get app(): TurtleApp | undefined {
    return this._app;
  }

  @Input()
  set app(app: TurtleApp | undefined) {
    this._app = app;

    if (app) {
      this.fetching = true;

      this.appUsers$ = combineLatest(
        this.userFilter$,
        this.limit$
      ).pipe(
        tap(_ => this.fetching = true),
        switchMap(([userId, limit]) => this.consoleService.getAppUsers$(app.appId, limit, userId))
      ).pipe(
        tap(users => {
          const limit       = this.limit$.value;
          this.fetching     = false;
          this.showLoadMore = users.length === limit && limit < this.maxLimit;
        })
      );
    }
  }

  readonly limitIncrement = 20;
  readonly maxLimit       = 200;

  // tslint:disable-next-line:variable-name
  _app: TurtleApp | undefined;
  userFilter$ = new BehaviorSubject<string>('');
  appUsers$: Observable<AppUser[]> | undefined;
  limit$ = new BehaviorSubject<number>(this.limitIncrement);
  displayedColumns: string[] = ['userId', 'createdAt', 'balance', 'options'];

  searchValue     = '';
  creatingUser    = false;
  fetching        = false;
  showLoadMore    = false;

  constructor(
    private consoleService: ConsoleService,
    private dialogService: DialogService,
    private snackBar: MatSnackBar) { }

  ngOnInit() {
  }

  createAppUser() {
    if (!this.app) {
      return;
    }

    this.creatingUser = true;

    this.consoleService.createAppUser(this.app.appId, this.app.appSecret).then(([user, error]) => {
      if (user) {
        this.snackBar.open(`new app user created: ${user.userId}`, undefined, { duration: 6000 });
      } else {
        console.log((error as ServiceError).message);
        this.snackBar.open('failed to create app user.', undefined, { duration: 6000 });
      }
      this.creatingUser = false;
    }).catch(_ => {
      console.log('error creating app user.');
      this.creatingUser = false;
    });
  }

  onSearchValueChanged(searchValue: string) {
    this.searchValue = searchValue;
    this.userFilter$.next(searchValue);
  }

  userDetailsClick(userId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openUserDetailsDialog(userId, this.app);
  }

  loadMoreClick() {
    this.limit$.next(this.limit$.value + this.limitIncrement);
  }

  userWithdraw(userId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openUserWithdrawDialog(userId, this.app);
  }

  userTransfer(userId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openUserTransferDialog(userId, this.app);
  }

  userSetWithdrawAddress(userId: string) {
    if (!this.app) {
      return;
    }

    this.dialogService.openUserWithdrawAddressDialog(userId, this.app);
  }

  userDelete(userId: string) {
    console.log('handle user delete...');
  }

  userReactivate(userId: string) {
    console.log('handle user reactivate...');
  }
}
