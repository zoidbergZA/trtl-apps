import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { TurtleApp } from 'shared/types';

@Component({
  selector: 'app-inspector',
  templateUrl: './app-inspector.component.html',
  styleUrls: ['./app-inspector.component.scss']
})
export class AppInspectorComponent implements OnInit {

  searchValue = '';
  fetching = false;
  app: TurtleApp | undefined;

  constructor(private adminService: AdminService) { }

  ngOnInit() {
  }

  onSearchValueChanged(searchValue: string) {
    this.searchValue = searchValue;
  }

  async onSearchClick() {
    this.app = undefined;

    if (this.fetching || this.searchValue === '') {
      return;
    }

    this.fetching = true;
    this.app = await this.adminService.getApp(this.searchValue);
    this.fetching = false;
  }
}
