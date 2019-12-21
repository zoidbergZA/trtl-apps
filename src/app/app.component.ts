import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent  {
  title = 'turtle-apps';
  showSideNav = false;
  appId: string | undefined;

  constructor(private router: Router) {
    router.events.pipe(filter(event => event instanceof NavigationEnd))
    .subscribe((event) => {
      const navEnd = event as NavigationEnd;

      if (navEnd.url.startsWith('/app')) {
        this.showSideNav = true;
        this.appId = navEnd.url.split('/')[2];

      } else {
        this.showSideNav = false;
        this.appId = undefined;
      }
    });
  }
}
