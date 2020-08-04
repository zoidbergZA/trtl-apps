import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { SavedWallet } from 'functions/src/types';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material';
import { BehaviorSubject } from 'rxjs';
import { switchMap, tap } from 'rxjs/operators';

@Component({
  selector: 'wallet-history',
  templateUrl: './wallet-history.component.html',
  styleUrls: ['./wallet-history.component.scss']
})
export class WalletHistoryComponent implements OnInit {
  savedWallets$: Observable<SavedWallet[]> | undefined;
  displayedColumns: string[] = ['date', 'info', 'id'];
  querySize$ = new BehaviorSubject(200);
  loading = true;

  constructor(public dialog: MatDialog, private adminService: AdminService) { }

  onLoadMoreClick() {
    this.loading = true;
    this.querySize$.next(this.querySize$.value + 200);
  }

  ngOnInit() {
    this.savedWallets$ = this.querySize$.pipe(
      switchMap(size => this.adminService.getWalletSavesHistory$(size)),
      tap(_ => this.loading = false)
    );
  }
}
