import { Component, OnInit, EventEmitter, Output, Input } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'search-box',
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss']
})
export class SearchBoxComponent implements OnInit {

  @Input() debounceTime = 300;

  @Output() searchChanged = new EventEmitter<string>();

  form: FormGroup;

  constructor() {
    this.form = new FormGroup({
      search: new FormControl()
    });
  }

  ngOnInit() {
    // TODO: unsubscribe
    this.form.controls.search.valueChanges.pipe(
      debounceTime(this.debounceTime)
    ).subscribe(v => {
      this.searchChanged.emit(v);
    });
  }

  onClearClick() {
    this.form.controls.search.setValue('');
    // this.value = '';
  }
}
