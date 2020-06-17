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

  onWalletManagementClick() {
    this.router.navigate(['/admin/wallet-management']);
  }

  onReportsClick() {
    this.router.navigate(['/admin/reports']);
  }

  onAppInspectorClick() {
    this.router.navigate(['/admin/app-inspector']);
  }

  onInspectDepositClick() {
    this.router.navigate(['/admin/deposit-inspector']);
  }

  onInspectWithdrawalClick() {
    this.router.navigate(['/admin/withdrawal-inspector']);
  }

  onRoleManagementClick() {
    this.router.navigate(['/admin/role-management']);
  }
}
