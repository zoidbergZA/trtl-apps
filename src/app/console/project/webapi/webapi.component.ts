import { Component, OnInit } from '@angular/core';
import { ConsoleService } from 'src/app/providers/console.service';
import { ActivatedRoute } from '@angular/router';
import { TurtleApp } from 'shared/types';

@Component({
  selector: 'app-webapi',
  templateUrl: './webapi.component.html',
  styleUrls: ['./webapi.component.scss']
})
export class WebapiComponent implements OnInit {

  appId: string | undefined;
  app: TurtleApp | undefined;
  displayedColumns: string[] = ['userId', 'withdrawAddress', 'balance', 'options'];
  creatingUser = false;

  constructor(
    private route: ActivatedRoute,
    private consoleService: ConsoleService) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.appId = params.appId;

      if (this.appId) {
        this.consoleService.getApp$(this.appId).subscribe(app => {
          this.app = app;
        });
      }
    });
  }
}
