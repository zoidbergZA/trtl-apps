import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeManagementComponent } from './node-management.component';

describe('NodeManagementComponent', () => {
  let component: NodeManagementComponent;
  let fixture: ComponentFixture<NodeManagementComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NodeManagementComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
