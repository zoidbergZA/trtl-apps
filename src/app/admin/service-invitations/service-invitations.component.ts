import { Component, OnInit } from '@angular/core';
import { Observable } from 'rxjs';
import { AppInviteCode } from 'functions/src/types';
import { AdminService } from 'src/app/providers/admin.service';

@Component({
  selector: 'service-invitations',
  templateUrl: './service-invitations.component.html',
  styleUrls: ['./service-invitations.component.scss']
})
export class ServiceInvitationsComponent implements OnInit {

  generating = false;
  error: string | undefined;
  invitations$: Observable<AppInviteCode[]> | undefined;

  constructor(private adminService: AdminService) {
  }

  ngOnInit() {
    this.invitations$ = this.adminService.getServiceInvitations$();
  }

  async onGenerateClick() {
    this.generating = true;
    this.error = undefined;

    try {
      await this.adminService.generateServiceInvitations(5);
    } catch (error) {
      this.error = error;
    } finally {
      this.generating = false;
    }
  }
}
