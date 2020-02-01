import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositInspectorComponent } from './deposit-inspector.component';

describe('DepositInspectorComponent', () => {
  let component: DepositInspectorComponent;
  let fixture: ComponentFixture<DepositInspectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DepositInspectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DepositInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
