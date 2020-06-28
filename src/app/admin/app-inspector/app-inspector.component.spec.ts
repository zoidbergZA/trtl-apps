import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AppInspectorComponent } from './app-inspector.component';

describe('AppInspectorComponent', () => {
  let component: AppInspectorComponent;
  let fixture: ComponentFixture<AppInspectorComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AppInspectorComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AppInspectorComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
