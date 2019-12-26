import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { DepositComponent } from './account-deposit.component';

describe('UserDepositComponent', () => {
  let component: DepositComponent;
  let fixture: ComponentFixture<DepositComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ DepositComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(DepositComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
