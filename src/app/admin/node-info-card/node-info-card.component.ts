import { Component, OnInit, Input } from '@angular/core';
import { ServiceNode } from 'functions/src/types';

@Component({
  selector: 'node-info-card',
  templateUrl: './node-info-card.component.html',
  styleUrls: ['./node-info-card.component.scss']
})
export class NodeInfoCardComponent implements OnInit {

  @Input() node: ServiceNode | undefined;

  constructor() { }

  ngOnInit() {
  }
}
