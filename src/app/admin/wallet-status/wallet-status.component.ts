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

  toHMS(miliseconds: number | undefined): string {
    if (!miliseconds) {
      return '0';
    }

    const totalSeconds = miliseconds / 1000;
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    let result = `${minutes
      .toString()
      .padStart(1, '0')}:${seconds.toString().padStart(2, '0')}`;
    if (!!hours) {
      result = `${hours.toString()}:${minutes
        .toString()
        .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return result;
  }
}
