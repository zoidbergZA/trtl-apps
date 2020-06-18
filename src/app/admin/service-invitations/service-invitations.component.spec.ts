import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceInvitationsComponent } from './service-invitations.component';

describe('ServiceInvitationsComponent', () => {
  let component: ServiceInvitationsComponent;
  let fixture: ComponentFixture<ServiceInvitationsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ServiceInvitationsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceInvitationsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
