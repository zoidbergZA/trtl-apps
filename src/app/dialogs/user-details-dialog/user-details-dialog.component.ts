import { Component, OnInit, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material';
import { ConsoleService } from 'src/app/providers/console.service';
import { AppUser, TurtleApp } from 'shared/types';
import { Observable } from 'rxjs';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'user-details-dialog',
  templateUrl: './user-details-dialog.component.html',
  styleUrls: ['./user-details-dialog.component.scss']
})
export class UserDetailsDialogComponent implements OnInit {

  app: TurtleApp;
  userId: string;
  appUser$: Observable<AppUser | undefined>;

  constructor(
    public dialogRef: MatDialogRef<UserDetailsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: any,
    private consoleService: ConsoleService
  ) {
    this.app      = data.app;
    this.userId   = data.userId;
    this.appUser$ = this.consoleService.getAppUser$(this.app.appId, this.userId);
  }

  ngOnInit() {
  }

  onCloseClick(): void {
    this.dialogRef.close();
  }
}
