import { Component, OnInit, Input } from '@angular/core';
import { TurtleApp } from 'shared/types';
import { AdminService } from 'src/app/providers/admin.service';
import { AppAuditResult } from 'functions/src/types';

@Component({
  selector: 'app-audit-history',
  templateUrl: './app-audit-history.component.html',
  styleUrls: ['./app-audit-history.component.scss']
})
export class AppAuditHistoryComponent implements OnInit {

  fetching = false;
  audits: AppAuditResult[] | undefined;

  private _app: TurtleApp | undefined;

  get app(): TurtleApp | undefined {
    return this._app;
  }

  @Input()
  set app(val: TurtleApp | undefined) {
    this._app = val;
    this.refresh();
  }

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  async refresh() {
    this.audits = undefined;

    if (this.app) {
      this.fetching = true;
      this.audits = await this.adminService.getAppAudits(this.app.appId);
      this.fetching = false;
    }
  }
}
