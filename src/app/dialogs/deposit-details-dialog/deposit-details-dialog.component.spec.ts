import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositDetailsDialogComponent } from './deposit-details-dialog.component';

describe('DepositDetailsDialogComponent', () => {
  let component: DepositDetailsDialogComponent;
  let fixture: ComponentFixture<DepositDetailsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DepositDetailsDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DepositDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
