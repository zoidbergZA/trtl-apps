import { Component, OnInit } from '@angular/core';
import { Constants } from 'src/constants';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'get-started-node',
  templateUrl: './get-started-node.component.html',
  styleUrls: ['./get-started-node.component.scss']
})
export class GetStartedNodeComponent implements OnInit {

  npmPackageLink = Constants.trtlAppsNpmLink;

  constructor() { }

  ngOnInit() {
  }
}
