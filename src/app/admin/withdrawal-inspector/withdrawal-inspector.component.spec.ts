import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WithdrawalInspectorComponent } from './withdrawal-inspector.component';

describe('WithdrawalInspectorComponent', () => {
  let component: WithdrawalInspectorComponent;
  let fixture: ComponentFixture<WithdrawalInspectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WithdrawalInspectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WithdrawalInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
