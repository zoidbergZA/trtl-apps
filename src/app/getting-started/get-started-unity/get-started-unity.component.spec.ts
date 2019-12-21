import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GetStartedUnityComponent } from './get-started-unity.component';

describe('GetStartedUnityComponent', () => {
  let component: GetStartedUnityComponent;
  let fixture: ComponentFixture<GetStartedUnityComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GetStartedUnityComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GetStartedUnityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
