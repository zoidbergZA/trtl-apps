import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AddUserRoleDialogComponent } from './add-user-role-dialog.component';

describe('AddUserRoleDialogComponent', () => {
  let component: AddUserRoleDialogComponent;
  let fixture: ComponentFixture<AddUserRoleDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AddUserRoleDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AddUserRoleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
