import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from 'src/app/providers/auth.service';

@Component({
  selector: 'project-sidenav',
  templateUrl: './project-sidenav.component.html',
  styleUrls: ['./project-sidenav.component.scss']
})
export class ProjectSidenavComponent implements OnInit, OnDestroy {

  @Input() appId: string | undefined;

  constructor(public auth: AuthService, private router: Router) { }

  ngOnInit() {
  }

  ngOnDestroy() {

  }

  overviewClick() {
    if (this.appId) {
      this.router.navigateByUrl(`app/${this.appId}/overview`);
    }
  }

  webApiClick() {
    if (this.appId) {
      this.router.navigateByUrl(`app/${this.appId}/webapi`);
    }
  }
}
