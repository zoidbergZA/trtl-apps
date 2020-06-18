import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { switchMap } from 'rxjs/operators';
import { AppAuditResult } from 'functions/src/types';
import { Observable, from } from 'rxjs';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'app-audit-details',
  templateUrl: './app-audit-details.component.html',
  styleUrls: ['./app-audit-details.component.scss']
})
export class AppAuditDetailsComponent implements OnInit {

  audit$: Observable<AppAuditResult | undefined>;

  constructor(private route: ActivatedRoute, private adminService: AdminService) {
    this.audit$ = this.route.paramMap.pipe(
      switchMap(params => {
        const auditId = params.get('auditId');

        if (auditId) {
          return this.adminService.getAppAudit$(auditId);
        } else {
          return from([]);
        }
      })
    );
  }

  ngOnInit() {
  }
}
