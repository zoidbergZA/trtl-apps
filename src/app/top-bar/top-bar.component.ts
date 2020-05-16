import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { takeUntil } from 'rxjs/operators';
import { componentDestroyed } from '@w11k/ngx-componentdestroyed';
import { AuthService } from '../providers/auth.service';
import { MatSnackBar } from '@angular/material';
import { Constants } from '../../constants';

@Component({
  selector: 'app-top-bar',
  templateUrl: './top-bar.component.html',
  styleUrls: ['./top-bar.component.scss']
})
export class TopBarComponent implements OnInit, OnDestroy {

  user: firebase.User | null = null;

  constructor(
    public authService: AuthService,
    private router: Router,
    private snackBar: MatSnackBar) { }

    ngOnInit() {
      this.authService.firebaseAuth.authState.pipe(takeUntil(componentDestroyed(this)))
      .subscribe(user => {
        this.user = user;
      });
    }

    ngOnDestroy() { }

  onSignInClick() {
    this.router.navigate(['/signin'], { queryParams: { continue: '/console' } });
  }

  onSignOutClick() {
    this.authService.signout();
  }

  onGetStartedClick() {
    this.router.navigate(['getstarted']);
  }

  onGetStartedNodeClick() {
    window.open(Constants.trtlAppsNpmLink, '_blank');
  }

  onGetStartedHttpClick() {
    window.open('/docs/openapi/', '_blank');
  }

  onAdminClick() {
    this.router.navigate(['/admin']);
  }

  onSupportClick() {
    this.router.navigate(['/support']);
  }

  onUserProfileClick() {
    this.router.navigate(['/user/profile']);
  }

  onConsoleClick() {
    this.router.navigate(['/console']);
  }
}
