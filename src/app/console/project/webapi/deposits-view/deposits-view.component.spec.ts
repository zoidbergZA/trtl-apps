import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositsViewComponent } from './deposits-view.component';

describe('DepositsViewComponent', () => {
  let component: DepositsViewComponent;
  let fixture: ComponentFixture<DepositsViewComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DepositsViewComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DepositsViewComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
