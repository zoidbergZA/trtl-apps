import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NodeInfoCardComponent } from './node-info-card.component';

describe('NodeInfoCardComponent', () => {
  let component: NodeInfoCardComponent;
  let fixture: ComponentFixture<NodeInfoCardComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NodeInfoCardComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NodeInfoCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
