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
    private router: Router,
    private authService: AuthService,
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
    // this.router.navigate(['getstarted/node']);
  }

  // onGetStartedUnityClick() {
  //   this.router.navigate(['getstarted/unity']);
  // }

  onGetStartedHttpClick() {
    window.open('/docs/openapi/', '_blank');
    // this.router.navigate(['getstarted/http']);
  }

  // onGithubClick() {
  //   this.snackBar.open('coming soon', undefined, { duration: 6000 });
  // }

  onSupportClick() {
    this.router.navigate(['/support']);
  }

  onAccountClick() {
    console.log('todo: handle account click');
  }

  onConsoleClick() {
    this.router.navigate(['/console']);
  }
}
