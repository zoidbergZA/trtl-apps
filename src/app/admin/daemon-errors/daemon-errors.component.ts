import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { Observable } from 'rxjs';
import { DaemonErrorEvent } from 'shared/types';

@Component({
  selector: 'daemon-errors',
  templateUrl: './daemon-errors.component.html',
  styleUrls: ['./daemon-errors.component.scss']
})
export class DaemonErrorsComponent implements OnInit {

  daemonErrors$: Observable<DaemonErrorEvent[]>;

  constructor(private adminService: AdminService) {
    this.daemonErrors$ = this.adminService.getDaemonErrors$();
  }

  ngOnInit() {

  }
}
