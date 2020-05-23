import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { SavedWallet } from 'functions/src/types';
import { WalletStatus } from 'shared/types';
import { Observable } from 'rxjs';
import { RewindWalletDialogComponent } from '../rewind-wallet-dialog/rewind-wallet-dialog.component';
import { MatDialog } from '@angular/material';

const ELEMENT_DATA: WalletStatus[] = [
  { name: 'firebase', started: true, uptime: 10000, daemonHost: 'trtl-pay.io', daemonPort: 8888, walletHeight: 5, networkHeight: 5 },
  { name: 'app engine', started: true, uptime: 13000, daemonHost: 'trtl-pay.io', daemonPort: 8888, walletHeight: 4, networkHeight: 5 }
];

@Component({
  selector: 'wallet-history',
  templateUrl: './wallet-history.component.html',
  styleUrls: ['./wallet-history.component.scss']
})
export class WalletHistoryComponent implements OnInit {
  fetchingStatus = false;
  displayedColumns: string[] = ['name', 'started', 'uptime', 'host', 'port', 'wHeight', 'nHeight'];
  dataSource = ELEMENT_DATA;
  savedWallets$: Observable<SavedWallet[]> | undefined;

  status: WalletStatus[] | undefined;

  constructor(public dialog: MatDialog, private adminService: AdminService) { }

  ngOnInit() {
    this.savedWallets$ = this.adminService.getWalletSavesHistory$(200);
  }

  async refreshStatusClick() {
    this.fetchingStatus = true;
    this.status  = await this.adminService.getWalletStatus();
    console.log(this.status);
    this.fetchingStatus = false;
  }

  rewindServiceWallet() {
    this.dialog.open(RewindWalletDialogComponent, {
      width: '800px',
    });
  }
}
