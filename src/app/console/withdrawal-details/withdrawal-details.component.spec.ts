import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WithdrawalDetailsComponent } from './withdrawal-details.component';

describe('WithdrawalDetailsComponent', () => {
  let component: WithdrawalDetailsComponent;
  let fixture: ComponentFixture<WithdrawalDetailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WithdrawalDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WithdrawalDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
