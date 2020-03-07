import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ConsoleService } from 'src/app/providers/console.service';
import { TurtleApp } from 'shared/types';
import { MatDialog, MatSnackBar } from '@angular/material';
import { ViewSecretDialogComponent } from 'src/app/dialogs/view-secret-dialog/view-secret-dialog.component';
import { SetWebhookDialogComponent } from 'src/app/dialogs/set-webhook-dialog/set-webhook-dialog.component';
import { ConfirmationDialogComponent } from 'src/app/dialogs/confirmation-dialog/confirmation-dialog.component';

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent implements OnInit {

  appId: string | undefined;
  app: TurtleApp | undefined;
  changingState = false;
  stateErrorMessage: string | undefined;

  constructor(
    public dialog: MatDialog,
    private route: ActivatedRoute,
    private consoleService: ConsoleService,
    private snackbar: MatSnackBar) { }

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
      data: {
        appId: this.appId,
        appSecret: this.app.appSecret
      }
    });
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

  async setAppState(active: boolean) {
    if (!this.app) {
      return;
    }

    this.stateErrorMessage = undefined;

    const ref = this.dialog.open(ConfirmationDialogComponent, {
      width: '800px',
      data: {
        title: `Are you sure you?`,
        content: `Type the name of the app in the box below to confirm: ${this.app.name}`,
        matchString: this.app.name
      }
    });

    ref.afterClosed().subscribe(async result => {
      if (result && this.app) {
        this.changingState = true;

        try {
          await this.consoleService.setAppState(this.app.appId, active);

          const msg = active  ? 'App successfully activated.'
                              : 'App successfully disabled.';

          this.snackbar.open(msg, undefined, {
            duration: 6000,
          });

        } catch (error) {
            this.stateErrorMessage = error;
        } finally {
          this.changingState = false;
        }
      }
    });
  }
}
