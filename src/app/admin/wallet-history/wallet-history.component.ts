import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { SavedWallet } from 'functions/src/types';
import { Observable } from 'rxjs';
import { MatDialog } from '@angular/material';

@Component({
  selector: 'wallet-history',
  templateUrl: './wallet-history.component.html',
  styleUrls: ['./wallet-history.component.scss']
})
export class WalletHistoryComponent implements OnInit {
  savedWallets$: Observable<SavedWallet[]> | undefined;

  constructor(public dialog: MatDialog, private adminService: AdminService) { }

  ngOnInit() {
    this.savedWallets$ = this.adminService.getWalletSavesHistory$(200);
  }
}
