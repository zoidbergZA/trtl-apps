import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppAuditDetailsComponent } from './app-audit-details.component';

describe('AppAuditDetailsComponent', () => {
  let component: AppAuditDetailsComponent;
  let fixture: ComponentFixture<AppAuditDetailsComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AppAuditDetailsComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppAuditDetailsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
