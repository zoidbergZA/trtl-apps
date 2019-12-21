import { Component, OnInit, Input } from '@angular/core';
import { ClipboardService } from 'ngx-clipboard';
import { MatSnackBar } from '@angular/material';

@Component({
  // tslint:disable-next-line:component-selector
  selector: 'copy-string-box',
  templateUrl: './copy-string-box.component.html',
  styleUrls: ['./copy-string-box.component.scss']
})
export class CopyStringBoxComponent implements OnInit {

  @Input() data: string | undefined;

  constructor(
    private clipboardService: ClipboardService,
    private snackBar: MatSnackBar) { }

  ngOnInit() {
  }

  onCopyKeyClick() {
    if (!this.data) {
      return;
    }

    const copied = this.clipboardService.copyFromContent(this.data);

    if (copied) {
      this.snackBar.open('copied to clipboard!', undefined, { duration: 4000 });
    }
  }
}
