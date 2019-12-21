import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { UserTransferDialogComponent } from './user-transfer-dialog.component';

describe('UserTranferDialogComponent', () => {
  let component: UserTransferDialogComponent;
  let fixture: ComponentFixture<UserTransferDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ UserTransferDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(UserTransferDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
