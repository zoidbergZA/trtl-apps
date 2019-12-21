import { Component, OnInit } from '@angular/core';
import { ConsoleService } from '../providers/console.service';
import { TurtleApp } from 'shared/types';
import { Observable } from 'rxjs';

@Component({
  selector: 'app-console',
  templateUrl: './console.component.html',
  styleUrls: ['./console.component.scss']
})
export class ConsoleComponent implements OnInit {

  projects$: Observable<TurtleApp[]> | undefined;

  constructor(private consoleService: ConsoleService) { }

  ngOnInit() {
    this.projects$ = this.consoleService.getUserApps();
  }
}
