import { Component, OnInit } from '@angular/core';
import { Constants } from 'src/constants';

@Component({
  selector: 'getting-started',
  templateUrl: './getting-started.component.html',
  styleUrls: ['./getting-started.component.scss']
})
export class GettingStartedComponent implements OnInit {

  npmPackageLink = Constants.trtlAppsNpmLink;

  constructor() { }

  ngOnInit() {
  }
}
