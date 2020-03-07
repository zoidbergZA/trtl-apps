import { Component, OnInit, Input } from '@angular/core';
import { Router } from '@angular/router';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'project-card',
  templateUrl: './project-card.component.html',
  styleUrls: ['./project-card.component.scss']
})
export class ProjectCardComponent implements OnInit {

  @Input() createNew = false;
  @Input() name: string | undefined;
  @Input() appId: string | undefined;
  @Input() disabled: boolean | undefined;

  constructor(private router: Router) { }

  ngOnInit() {
  }

  onCardClick() {
    if (this.createNew) {
      this.router.navigate(['/newapp']);
    } else {
      if (this.appId) {
        this.router.navigate([`/app/${this.appId}/overview`]);
      }
    }
  }
}
