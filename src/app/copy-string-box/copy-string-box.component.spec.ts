import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CopyStringBoxComponent } from './copy-string-box.component';

describe('CopyStringBoxComponent', () => {
  let component: CopyStringBoxComponent;
  let fixture: ComponentFixture<CopyStringBoxComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CopyStringBoxComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CopyStringBoxComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
