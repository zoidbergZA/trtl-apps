import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DaemonErrorsComponent } from './daemon-errors.component';

describe('DaemonErrorsComponent', () => {
  let component: DaemonErrorsComponent;
  let fixture: ComponentFixture<DaemonErrorsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DaemonErrorsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DaemonErrorsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
