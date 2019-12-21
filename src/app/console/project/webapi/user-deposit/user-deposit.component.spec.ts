import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UserDepositComponent } from './user-deposit.component';

describe('UserDepositComponent', () => {
  let component: UserDepositComponent;
  let fixture: ComponentFixture<UserDepositComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ UserDepositComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserDepositComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
