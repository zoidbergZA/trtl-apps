import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { filter, takeUntil } from 'rxjs/operators';
import { FormGroup, FormControl, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { AuthService } from '../providers/auth.service';
import { DialogService } from '../providers/dialog.service';

@Component({
  selector: 'app-sign-in',
  templateUrl: './sign-in.component.html',
  styleUrls: ['./sign-in.component.scss']
})
export class SignInComponent implements OnInit, OnDestroy {
  ngUnsubscribe: Subject<any> = new Subject();
  form: FormGroup;
  continueTo: string;
  working = false;
  errorMessage: string | undefined;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private dialogService: DialogService,
    private auth: AuthService) {

    // set default continue route
    this.continueTo = '/console';

    this.form = new FormGroup({
      email: new FormControl('', Validators.compose([
        Validators.required
      ])),
      password: new FormControl('', Validators.compose([
        Validators.required
      ]))
    });
  }

  ngOnInit() {
    this.route.queryParams.pipe(
      filter(params => params.continue),
      takeUntil(this.ngUnsubscribe))
    .subscribe(params => {
      this.continueTo = params.continue;
    });
  }

  ngOnDestroy(): void {
    this.ngUnsubscribe.next();
    this.ngUnsubscribe.complete();
  }

  onSubmit(result: any) {
    this.working = true;
    this.errorMessage = undefined;

    this.auth.signInWithEmailAndPassword(result.email, result.password)
    .then(_ => {
      this.errorMessage = undefined;
      this.router.navigateByUrl(this.continueTo);
    })
    .catch(error => {
      this.errorMessage = error.message;
      console.log(error);
    })
    .finally(() => this.working = false);
  }

  lostPasswordClick() {
    this.dialogService.openPasswordRecoveryDialog();
  }

  registerClick() {
    const continueTo = `${window.location.origin}/console`;
    this.router.navigate(['/register'], { queryParams: { continue: continueTo } });
  }
}
