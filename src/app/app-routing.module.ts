import { NgModule } from '@angular/core';
import { AngularFireAuthGuard, redirectUnauthorizedTo, redirectLoggedInTo } from '@angular/fire/auth-guard';
import { Routes, RouterModule } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { ConsoleComponent } from './console/console.component';
import { RegisterComponent } from './sign-in/register/register.component';
import { NewProjectComponent } from './console/new-project/new-project.component';
import { OverviewComponent } from './console/project/overview/overview.component';
import { WebapiComponent } from './console/project/webapi/webapi.component';
// import { GetStartedNodeComponent } from './getting-started/get-started-node/get-started-node.component';
// import { GetStartedUnityComponent } from './getting-started/get-started-unity/get-started-unity.component';
// import { GetStartedHttpComponent } from './getting-started/get-started-http/get-started-http.component';
import { GettingStartedComponent } from './getting-started/getting-started.component';
import { SupportComponent } from './support/support.component';
import { WebhooksComponent } from './documentation/webhooks/webhooks.component';
import { DocumentationComponent } from './documentation/documentation.component';
import { AdminComponent } from './admin/admin.component';
import { UserProfileComponent } from './user-profile/user-profile.component';

const redirectUnauthorizedToSignIn  = () => redirectUnauthorizedTo(['/signin']);
const redirectLoggedInToConsole     = () => redirectLoggedInTo(['/console']);

const routes: Routes = [
  {
    path:         'docs',
    component:    DocumentationComponent,
  },
  {
    path:         'docs/webhooks',
    component:    WebhooksComponent,
  },
  {
    path:         'getstarted',
    component:    GettingStartedComponent,
  },
  // {
  //   path:         'getstarted/node',
  //   component:    GetStartedNodeComponent,
  // },
  // {
  //   path:         'getstarted/unity',
  //   component:    GetStartedUnityComponent,
  // },
  // {
  //   path:         'getstarted/http',
  //   component:    GetStartedHttpComponent,
  // },
  {
    path:         'support',
    component:    SupportComponent,
  },
  {
    path:         'signin',
    component:    SignInComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectLoggedInToConsole }
  },
  {
    path:         'register',
    component:    RegisterComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectLoggedInToConsole }
  },
  {
    path:         'user/profile',
    component:    UserProfileComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectUnauthorizedToSignIn }
  },
  {
    path:         'console',
    component:    ConsoleComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectUnauthorizedToSignIn }
  },
  {
    path:         'admin',
    component:    AdminComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectUnauthorizedToSignIn }
  },
  {
    path:         'newapp',
    component:    NewProjectComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectUnauthorizedToSignIn }
  },
  {
    path:         'app/:appId/overview',
    component:    OverviewComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectUnauthorizedToSignIn }
  },
  {
    path:         'app/:appId/webapi',
    component:    WebapiComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectUnauthorizedToSignIn }
  },
  {
    path:         'home',
    component:    HomeComponent,
    canActivate:  [AngularFireAuthGuard],
    data:         { authGuardPipe: redirectLoggedInToConsole }
  },
  {
    path:         '**',
    redirectTo:   '/home',
    pathMatch:    'full'
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
