import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  selector: 'admin-side-nav',
  templateUrl: './admin-side-nav.component.html',
  styleUrls: ['./admin-side-nav.component.scss']
})
export class AdminSideNavComponent implements OnInit {

  constructor(private router: Router) { }

  ngOnInit() {
  }

  onServiceStatusClick() {
    this.router.navigate(['/admin']);
  }

  onWalletHistoryClick() {
    this.router.navigate(['/admin/wallet-history']);
  }

  onServiceConfigClick() {
    this.router.navigate(['/admin/config-management']);
  }

  onReportsClick() {
    this.router.navigate(['/admin/reports']);
  }

  onServiceChargeManagementClick() {
    this.router.navigate(['/admin/charges-management']);
  }

  onInspectDepositClick() {
    this.router.navigate(['/admin/deposit-inspector']);
  }

  onInspectWithdrawalClick() {
    this.router.navigate(['/admin/withdrawal-inspector']);
  }
}
