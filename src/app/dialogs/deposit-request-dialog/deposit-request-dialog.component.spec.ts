import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositRequestDialogComponent } from './deposit-request-dialog.component';

describe('DepositRequestDialogComponent', () => {
  let component: DepositRequestDialogComponent;
  let fixture: ComponentFixture<DepositRequestDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DepositRequestDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DepositRequestDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
