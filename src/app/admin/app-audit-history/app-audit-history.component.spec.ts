import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppAuditHistoryComponent } from './app-audit-history.component';

describe('AppAuditHistoryComponent', () => {
  let component: AppAuditHistoryComponent;
  let fixture: ComponentFixture<AppAuditHistoryComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AppAuditHistoryComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppAuditHistoryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
