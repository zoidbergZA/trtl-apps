import { Component, OnInit } from '@angular/core';
import { AdminService } from 'src/app/providers/admin.service';
import { Observable } from 'rxjs';
import { ServiceNode } from 'functions/src/types';
import { MatDialog } from '@angular/material';
import { EditNodeDialogComponent } from '../dialogs/edit-node-dialog/edit-node-dialog.component';

@Component({
  selector: 'node-management',
  templateUrl: './node-management.component.html',
  styleUrls: ['./node-management.component.scss']
})
export class NodeManagementComponent implements OnInit {

  nodes$: Observable<ServiceNode[]> | undefined;

  constructor(
    public dialog: MatDialog,
    private adminService: AdminService
  ) { }

  ngOnInit() {
    this.nodes$ = this.adminService.getServiceNodes$();
  }

  onAddNodeClick() {
    this.dialog.open(EditNodeDialogComponent, {
      width: '800px'
    });
  }
}
