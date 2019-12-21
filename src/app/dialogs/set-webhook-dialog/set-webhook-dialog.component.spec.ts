import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { SetWebhookDialogComponent } from './set-webhook-dialog.component';

describe('SetWebhookDialogComponent', () => {
  let component: SetWebhookDialogComponent;
  let fixture: ComponentFixture<SetWebhookDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ SetWebhookDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(SetWebhookDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
