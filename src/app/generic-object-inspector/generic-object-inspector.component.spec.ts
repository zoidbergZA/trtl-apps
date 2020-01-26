import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GenericObjectInspectorComponent } from './generic-object-inspector.component';

describe('GenericObjectInspectorComponent', () => {
  let component: GenericObjectInspectorComponent;
  let fixture: ComponentFixture<GenericObjectInspectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GenericObjectInspectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GenericObjectInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
