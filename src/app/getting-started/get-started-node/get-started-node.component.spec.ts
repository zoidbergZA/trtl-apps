import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GetStartedNodeComponent } from './get-started-node.component';

describe('GetStartedNodeComponent', () => {
  let component: GetStartedNodeComponent;
  let fixture: ComponentFixture<GetStartedNodeComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GetStartedNodeComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GetStartedNodeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
