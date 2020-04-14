import { Component, OnInit } from '@angular/core';
import { AuthService } from '../providers/auth.service';
import { MatSnackBar } from '@angular/material';

@Component({
  selector: 'user-profile',
  templateUrl: './user-profile.component.html',
  styleUrls: ['./user-profile.component.scss']
})
export class UserProfileComponent implements OnInit {

  sendingEmail = false;

  constructor(public auth: AuthService, private snackbar: MatSnackBar) { }

  ngOnInit() {
  }

  async verifyEmailClick() {
    this.sendingEmail = true;

    const succeeded = await this.auth.sendVerificationEmail();

    this.sendingEmail = false;

    const msg = succeeded ? 'Verification e-mail has been successfully sent.'
                          : 'An error occured while sending verification e-mail, please try again later.';

    this.snackbar.open(msg, undefined, { duration: 6000 });
  }
}
