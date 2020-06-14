import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ServiceUser } from 'shared/types';

@Component({
  selector: 'admin-list-item',
  templateUrl: './admin-list-item.component.html',
  styleUrls: ['./admin-list-item.component.scss']
})
export class AdminListItemComponent implements OnInit {

  @Input() user: ServiceUser | undefined;

  @Output() removeRoleClick = new EventEmitter<ServiceUser>();

  constructor() { }

  ngOnInit() {
  }

  onRemoveClick() {
    this.removeRoleClick.emit(this.user);
  }
}
