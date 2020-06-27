import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NewSearchBoxComponent } from './new-search-box.component';

describe('NewSearchBoxComponent', () => {
  let component: NewSearchBoxComponent;
  let fixture: ComponentFixture<NewSearchBoxComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NewSearchBoxComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NewSearchBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
