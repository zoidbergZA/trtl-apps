import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AuditListItemComponent } from './audit-list-item.component';

describe('AuditListItemComponent', () => {
  let component: AuditListItemComponent;
  let fixture: ComponentFixture<AuditListItemComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AuditListItemComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AuditListItemComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
