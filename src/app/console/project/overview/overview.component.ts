import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConsoleService } from 'src/app/providers/console.service';
import { TurtleApp } from 'shared/types';
import { MatDialog } from '@angular/material';
import { ViewSecretDialogComponent } from 'src/app/dialogs/view-secret-dialog/view-secret-dialog.component';
import { SetWebhookDialogComponent } from 'src/app/dialogs/set-webhook-dialog/set-webhook-dialog.component';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {

  appId: string | undefined;
  app: TurtleApp | undefined;

  constructor(
    public dialog: MatDialog,
    private route: ActivatedRoute,
    private consoleService: ConsoleService) { }

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.appId = params.appId;

      if (this.appId) {
        this.consoleService.getApp(this.appId).subscribe(app => {
          this.app = app;
        });
      }
    });
  }

  viewSecretClick() {
    if (!this.app) {
      return;
    }

    this.dialog.open(ViewSecretDialogComponent, {
      width: '800px',
      data: { appSecret: this.app.appSecret }
    });
  }

  webhookInfoClick() {
    console.log('todo: handle webhook info click');
  }

  setWebHook() {
    if (!this.app) {
      return;
    }

    this.dialog.open(SetWebhookDialogComponent, {
      width: '800px',
      data: {
        appId: this.app.appId,
        initialValue: this.app.webhook
      }
    });
  }
}
