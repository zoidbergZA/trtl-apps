import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RemoveUserRoleDialogComponent } from './remove-user-role-dialog.component';

describe('RemoveUserRoleDialogComponent', () => {
  let component: RemoveUserRoleDialogComponent;
  let fixture: ComponentFixture<RemoveUserRoleDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RemoveUserRoleDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RemoveUserRoleDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
