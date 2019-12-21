import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TransfersViewComponent } from './transfers-view.component';

describe('TransfersViewComponent', () => {
  let component: TransfersViewComponent;
  let fixture: ComponentFixture<TransfersViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TransfersViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TransfersViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
