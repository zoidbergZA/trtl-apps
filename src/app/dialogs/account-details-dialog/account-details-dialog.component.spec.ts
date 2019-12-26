import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AccountDetailsDialogComponent } from './account-details-dialog.component';

describe('UserDetailsDialogComponent', () => {
  let component: AccountDetailsDialogComponent;
  let fixture: ComponentFixture<AccountDetailsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AccountDetailsDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AccountDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
