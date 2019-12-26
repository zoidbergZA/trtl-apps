import { Injectable } from '@angular/core';
import { MatDialog } from '@angular/material';
import { TurtleApp } from 'shared/types';
import { AccountDetailsDialogComponent } from '../dialogs/account-details-dialog/account-details-dialog.component';
import { DepositRequestDialogComponent } from '../dialogs/deposit-request-dialog/deposit-request-dialog.component';
import { WithdrawDialogComponent } from '../dialogs/withdraw-dialog/withdraw-dialog.component';
import { UserTransferDialogComponent } from '../dialogs/user-transfer-dialog/user-transfer-dialog.component';
import { SetAddressDialogComponent } from '../dialogs/set-address-dialog/set-address-dialog.component';
import { DepositDetailsDialogComponent } from '../dialogs/deposit-details-dialog/deposit-details-dialog.component';
import { WithdrawalDetailsDialogComponent } from '../dialogs/withdrawal-details-dialog/withdrawal-details-dialog.component';
import { TransferDetailsDialogComponent } from '../dialogs/transfer-details-dialog/transfer-details-dialog.component';
import { PasswordRecoveryDialogComponent } from '../dialogs/password-recovery-dialog/password-recovery-dialog.component';

@Injectable({
  providedIn: 'root'
})
export class DialogService {

  private readonly dialogWidth = '800px';

  constructor(public dialog: MatDialog) { }

  openAccountDetailsDialog(accountId: string, app: TurtleApp) {
    this.dialog.open(AccountDetailsDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { accountId, app }
    });
  }

  openDepositDetailsDialog(depositId: string, appId: string) {
    this.dialog.open(DepositDetailsDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { appId, depositId }
    });
  }

  openWithdrawalDetailsDialog(withdrawalId: string, appId: string) {
    this.dialog.open(WithdrawalDetailsDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { appId, withdrawalId }
    });
  }

  openTransferDetailsDialog(transferId: string, appId: string) {
    this.dialog.open(TransferDetailsDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { appId, transferId }
    });
  }

  openDepositRequestDialog(accountId: string, app: TurtleApp) {
    this.dialog.open(DepositRequestDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { accountId, app }
    });
  }

  openAccountWithdrawDialog(accountId: string, app: TurtleApp) {
    this.dialog.open(WithdrawDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { accountId, app }
    });
  }

  openTransferDialog(accountId: string, app: TurtleApp) {
    this.dialog.open(UserTransferDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { accountId, app }
    });
  }

  openWithdrawAddressDialog(accountId: string, app: TurtleApp) {
    this.dialog.open(SetAddressDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth,
      data: { accountId, app }
    });
  }

  openPasswordRecoveryDialog() {
    this.dialog.open(PasswordRecoveryDialogComponent, {
      autoFocus: false,
      width: this.dialogWidth
    });
  }
}
