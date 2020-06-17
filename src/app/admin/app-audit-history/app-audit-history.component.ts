import { Component, OnInit, Input } from '@angular/core';
import { TurtleApp } from 'shared/types';

@Component({
  selector: 'app-audit-history',
  templateUrl: './app-audit-history.component.html',
  styleUrls: ['./app-audit-history.component.scss']
})
export class AppAuditHistoryComponent implements OnInit {

  @Input() app: TurtleApp | undefined;

  constructor() { }

  ngOnInit() {
  }
}
