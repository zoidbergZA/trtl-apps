import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { WithdrawalDetailsDialogComponent } from './withdrawal-details-dialog.component';

describe('WithdrawalDetailsDialogComponent', () => {
  let component: WithdrawalDetailsDialogComponent;
  let fixture: ComponentFixture<WithdrawalDetailsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ WithdrawalDetailsDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(WithdrawalDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
