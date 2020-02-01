import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { ServiceChargeManagementComponent } from './service-charge-management.component';

describe('ServiceChargeManagementComponent', () => {
  let component: ServiceChargeManagementComponent;
  let fixture: ComponentFixture<ServiceChargeManagementComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ ServiceChargeManagementComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(ServiceChargeManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
