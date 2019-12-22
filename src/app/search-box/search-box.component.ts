import { Component, OnInit, EventEmitter, Output, Input, OnDestroy } from '@angular/core';
import { FormGroup, FormControl } from '@angular/forms';
import { debounceTime } from 'rxjs/operators';
import { SubscriptionLike } from 'rxjs';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'search-box',
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss']
})
export class SearchBoxComponent implements OnInit, OnDestroy {

  @Input() debounceTime = 300;

  @Output() searchChanged = new EventEmitter<string>();

  form: FormGroup;
  private searchSubscription: SubscriptionLike;

  constructor() {
    this.form = new FormGroup({
      search: new FormControl()
    });

    this.searchSubscription = this.form.controls.search.valueChanges.pipe(
      debounceTime(this.debounceTime)
    ).subscribe(v => {
      this.searchChanged.emit(v);
    });
  }

  ngOnInit() {
  }

  ngOnDestroy(): void {
    this.searchSubscription.unsubscribe();
  }

  onClearClick() {
    this.form.controls.search.setValue('');
  }
}
