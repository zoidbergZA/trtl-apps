import { Component, OnInit } from '@angular/core';
import { WalletStatus } from 'shared/types';
import { AdminService } from 'src/app/providers/admin.service';
import { MatDialog } from '@angular/material';
import { RewindWalletDialogComponent } from '../rewind-wallet-dialog/rewind-wallet-dialog.component';

@Component({
  selector: 'wallet-status',
  templateUrl: './wallet-status.component.html',
  styleUrls: ['./wallet-status.component.scss']
})
export class WalletStatusComponent implements OnInit {
  fetching = false;
  displayedColumns: string[] = ['name', 'started', 'uptime', 'host', 'wHeight', 'nHeight'];
  status: WalletStatus[] | undefined;

  constructor(public dialog: MatDialog, private adminService: AdminService) { }

  ngOnInit() {
  }

  async refreshStatusClick() {
    this.fetching = true;
    this.status  = await this.adminService.getWalletStatus();
    this.fetching = false;
  }

  rewindServiceWallet() {
    this.dialog.open(RewindWalletDialogComponent, {
      width: '800px',
    });
  }

  toMinutes(miliseconds: number | undefined): string {
    if (!miliseconds) {
      return '0';
    }

    return `${Math.ceil(miliseconds / 1000 / 60).toString()}mins`;
  }
}
