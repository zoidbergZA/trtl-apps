import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SetAddressDialogComponent } from './set-address-dialog.component';

describe('SetAddressDialogComponent', () => {
  let component: SetAddressDialogComponent;
  let fixture: ComponentFixture<SetAddressDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SetAddressDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SetAddressDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
