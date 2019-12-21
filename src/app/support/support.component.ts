import { Component, OnInit } from '@angular/core';
import { environment } from 'src/environments/environment';

@Component({
  selector: 'app-support',
  templateUrl: './support.component.html',
  styleUrls: ['./support.component.scss']
})
export class SupportComponent implements OnInit {

  donationAddress: string;
  donationQrCode: string;

  constructor() {
    this.donationAddress = environment.donationAddress;
    this.donationQrCode = `https://chart.googleapis.com/chart?cht=qr&chs=256x256&chl=turtlecoin://${this.donationAddress}`;
  }

  ngOnInit() {
  }
}
