import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { TurtleApp } from 'shared/types';

@Component({
  selector: 'app-inspector',
  templateUrl: './app-inspector.component.html',
  styleUrls: ['./app-inspector.component.scss']
})
export class AppInspectorComponent implements OnInit {

  fetching = false;
  app: TurtleApp | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  async onSearchClick(value: string) {
    this.app = undefined;

    if (this.fetching) {
      return;
    }
    this.fetching = true;
    this.app = await this.adminService.getApp(value);
    this.fetching = false;
  }
}
