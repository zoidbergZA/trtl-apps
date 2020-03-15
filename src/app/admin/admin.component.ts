import { Component, OnInit } from '@angular/core';
import { AdminService } from '../providers/admin.service';
import { ServiceStatus } from 'shared/types';
import { MatDialog } from '@angular/material';
import { RewindWalletDialogComponent } from './rewind-wallet-dialog/rewind-wallet-dialog.component';

@Component({
  selector: 'app-admin',
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent implements OnInit {

  serviceStatus: ServiceStatus | undefined;
  fetchingStatus = false;

  constructor(
    public dialog: MatDialog,
    private adminService: AdminService) { }

  ngOnInit() {
  }

  async serviceStatusClick() {
    this.fetchingStatus = true;
    this.serviceStatus  = await this.adminService.getServiceStatus();
    this.fetchingStatus = false;
  }

  rewindServiceWallet() {
    this.dialog.open(RewindWalletDialogComponent, {
      width: '800px',
    });
  }

  getSyncInfoString(syncInfo: [number, number, number]): string {
    const heightDelta = syncInfo[2] - syncInfo[0];
    return `wallet: ${syncInfo[0]}, daemon: ${syncInfo[1]}, network: ${syncInfo[2]}, height delta: ${heightDelta}`;
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
