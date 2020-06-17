import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { RewindWalletDialogComponent } from './rewind-wallet-dialog.component';

describe('RewindWalletDialogComponent', () => {
  let component: RewindWalletDialogComponent;
  let fixture: ComponentFixture<RewindWalletDialogComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ RewindWalletDialogComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(RewindWalletDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
