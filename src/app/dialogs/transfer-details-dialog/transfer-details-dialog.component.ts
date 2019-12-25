import { Component, OnInit, Inject } from '@angular/core';
import { Transfer } from 'shared/types';
import { Observable } from 'rxjs';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';

@Component({
  // tslint:disable-next-line: component-selector
  selector: 'transfer-details-dialog',
  templateUrl: './transfer-details-dialog.component.html',
  styleUrls: ['./transfer-details-dialog.component.scss']
})
export class TransferDetailsDialogComponent implements OnInit {

  appId: string;
  transferId: string;
  transfer$: Observable<Transfer | undefined>;

  constructor(
    public dialogRef: MatDialogRef<TransferDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService
  ) {
    this.appId      = data.appId;
    this.transferId = data.transferId;
    this.transfer$  = this.consoleService.getTransfer$(this.appId, this.transferId);
  }

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
