import { Component, OnInit, Input } from '@angular/core';
import { AppAuditResult } from 'functions/src/types';

@Component({
  selector: 'audit-list-item',
  templateUrl: './audit-list-item.component.html',
  styleUrls: ['./audit-list-item.component.scss']
})
export class AuditListItemComponent implements OnInit {

  @Input() audit: AppAuditResult | undefined;

  constructor() { }

  ngOnInit() {
  }
}
