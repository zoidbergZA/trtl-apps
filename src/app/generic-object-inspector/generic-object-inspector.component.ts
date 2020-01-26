import { Component, OnInit, Input } from '@angular/core';

@Component({
  selector: 'generic-object-inspector',
  templateUrl: './generic-object-inspector.component.html',
  styleUrls: ['./generic-object-inspector.component.scss']
})
export class GenericObjectInspectorComponent implements OnInit {

  @Input() object: any;

  constructor() { }

  ngOnInit() {
  }
}
