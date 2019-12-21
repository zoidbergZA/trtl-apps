import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { GetStartedHttpComponent } from './get-started-http.component';

describe('GetStartedHttpComponent', () => {
  let component: GetStartedHttpComponent;
  let fixture: ComponentFixture<GetStartedHttpComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ GetStartedHttpComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(GetStartedHttpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
