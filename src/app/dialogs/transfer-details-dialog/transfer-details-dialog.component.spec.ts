import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { TransferDetailsDialogComponent } from './transfer-details-dialog.component';

describe('TransferDetailsDialogComponent', () => {
  let component: TransferDetailsDialogComponent;
  let fixture: ComponentFixture<TransferDetailsDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ TransferDetailsDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(TransferDetailsDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
