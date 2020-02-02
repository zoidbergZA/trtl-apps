import { Component, OnInit, Input } from '@angular/core';
import { ServiceNode } from 'functions/src/types';
import { MatDialog } from '@angular/material';
import { EditNodeDialogComponent } from '../dialogs/edit-node-dialog/edit-node-dialog.component';

@Component({
  selector: 'node-info-card',
  templateUrl: './node-info-card.component.html',
  styleUrls: ['./node-info-card.component.scss']
})
export class NodeInfoCardComponent implements OnInit {

  @Input() node: ServiceNode | undefined;

  constructor(public dialog: MatDialog) { }

  ngOnInit() {
  }

  onEditClick() {
    if (!this.node) {
      return;
    }

    this.dialog.open(EditNodeDialogComponent, {
      width: '800px',
      data: this.node
    });
  }
}
