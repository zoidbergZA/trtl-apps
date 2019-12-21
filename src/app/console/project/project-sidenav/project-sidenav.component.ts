import { Component, OnInit, Input, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'project-sidenav',
  templateUrl: './project-sidenav.component.html',
  styleUrls: ['./project-sidenav.component.scss']
})
export class ProjectSidenavComponent implements OnInit, OnDestroy {

  @Input() appId: string | undefined;

  // @Input()
  // set appId(appId: string | undefined) {
  //   this.mAppId = appId;
  //   this.appId$.next(appId);
  // }

  // get appId(): string | undefined {
  //   return this.mAppId;
  // }

  // mAppId: string | undefined;
  // appId$: Subject<string | undefined> = new Subject();
  // app$: Observable<TurtleApp | undefined>;
  // ngUnsubscribe$: Subject<any> = new Subject();

  constructor(private router: Router) {
    // this.app$ = this.appId$.pipe(
    //   takeUntil(this.ngUnsubscribe$),
    //   filter(v => typeof v === 'string'),
    //   switchMap(appId => consoleService.getApp(appId as string))
    // );
  }

  ngOnInit() {
  }

  ngOnDestroy() {
    // this.completeSubjects();
  }

  // completeSubjects() {
  //   this.ngUnsubscribe$.next();
  //   this.ngUnsubscribe$.complete();
  //   this.appId$.complete();
  // }

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
