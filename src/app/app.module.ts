import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MaterialModule } from './modules/material.module';
import { AuthService } from './providers/auth.service';
import { HomeComponent } from './home/home.component';
import { ConsoleComponent } from './console/console.component';
import { OverviewComponent } from './console/project/overview/overview.component';
import { TopBarComponent } from './top-bar/top-bar.component';
import { SignInComponent } from './sign-in/sign-in.component';
import { RegisterComponent } from './sign-in/register/register.component';
import { AngularFireAuthModule } from '@angular/fire/auth';
import { AngularFirestoreModule } from '@angular/fire/firestore';
import { AngularFireModule } from '@angular/fire';
import { AngularFireFunctionsModule } from '@angular/fire/functions';
import { environment } from '../environments/environment';
import { AngularFireAuthGuard } from '@angular/fire/auth-guard';
import { FlexLayoutModule } from '@angular/flex-layout';
import { ProjectCardComponent } from './console/project-card/project-card.component';
import { MaterialElevationDirective } from './material-elevation.directive';
import { NewProjectComponent } from './console/new-project/new-project.component';
import { ConsoleService } from './providers/console.service';
import { ProjectSidenavComponent } from './console/project/project-sidenav/project-sidenav.component';
import { WebapiComponent } from './console/project/webapi/webapi.component';
import { HttpClientModule } from '@angular/common/http';
import { TruncateAddressPipe } from './pipes/truncate-address';
import { TurtleAmountPipe } from './pipes/trtl-amount';
import { AccountOptionsComponent } from './console/project/webapi/account-options/account-options.component';
import { DepositComponent } from './console/project/webapi/account-deposit/account-deposit.component';
import { GetStartedNodeComponent } from './getting-started/get-started-node/get-started-node.component';
import { GetStartedUnityComponent } from './getting-started/get-started-unity/get-started-unity.component';
import { GetStartedHttpComponent } from './getting-started/get-started-http/get-started-http.component';
import { ViewSecretDialogComponent } from './dialogs/view-secret-dialog/view-secret-dialog.component';
import { ClipboardModule } from 'ngx-clipboard';
import { AccountManagementComponent } from './console/project/webapi/account-management/account-management.component';
import { DepositsViewComponent } from './console/project/webapi/deposits-view/deposits-view.component';
import { DepositDetailsComponent } from './console/deposit-details/deposit-details.component';
import { DepositDetailsDialogComponent } from './dialogs/deposit-details-dialog/deposit-details-dialog.component';
import { SetAddressDialogComponent } from './dialogs/set-address-dialog/set-address-dialog.component';
import { CurrencyMaskModule } from 'ng2-currency-mask';
import { CurrencyMaskConfig, CURRENCY_MASK_CONFIG } from 'ng2-currency-mask/src/currency-mask.config';
import { TransferDialogComponent } from './dialogs/user-transfer-dialog/transfer-dialog.component';
import { WithdrawDialogComponent } from './dialogs/withdraw-dialog/withdraw-dialog.component';
import { WithdrawalsViewComponent } from './console/project/webapi/withdrawals-view/withdrawals-view.component';
import { TransfersViewComponent } from './console/project/webapi/transfers-view/transfers-view.component';
import { EditStringDialogComponent } from './dialogs/edit-string-dialog/edit-string-dialog.component';
import { SetWebhookDialogComponent } from './dialogs/set-webhook-dialog/set-webhook-dialog.component';
import { GettingStartedComponent } from './getting-started/getting-started.component';
import { CopyStringBoxComponent } from './copy-string-box/copy-string-box.component';
import { WithdrawalDetailsDialogComponent } from './dialogs/withdrawal-details-dialog/withdrawal-details-dialog.component';
import { WithdrawalDetailsComponent } from './console/withdrawal-details/withdrawal-details.component';
import { AccountDetailsDialogComponent } from './dialogs/account-details-dialog/account-details-dialog.component';
import { DialogService } from './providers/dialog.service';
import { TransferDetailsDialogComponent } from './dialogs/transfer-details-dialog/transfer-details-dialog.component';
import { SupportComponent } from './support/support.component';
import { RecipientFormComponent } from './dialogs/user-transfer-dialog/recipient-form/recipient-form.component';
import { SearchBoxComponent } from './search-box/search-box.component';
import { WebhooksComponent } from './documentation/webhooks/webhooks.component';
import { PasswordRecoveryDialogComponent } from './dialogs/password-recovery-dialog/password-recovery-dialog.component';
import { DocumentationComponent } from './documentation/documentation.component';
import { AdminComponent } from './admin/admin.component';
import { UserProfileComponent } from './user-profile/user-profile.component';
import { AdminService } from './providers/admin.service';
import { WithdrawalInspectorComponent } from './admin/withdrawal-inspector/withdrawal-inspector.component';
import { GenericObjectInspectorComponent } from './generic-object-inspector/generic-object-inspector.component';
import { DepositInspectorComponent } from './admin/deposit-inspector/deposit-inspector.component';
import { ServiceChargeManagementComponent } from './admin/service-charge-management/service-charge-management.component';
import { ConfigManagementComponent } from './admin/config-management/config-management.component';
import { NodeManagementComponent } from './admin/node-management/node-management.component';

export const CustomCurrencyMaskConfig: CurrencyMaskConfig = {
  align: 'left',
  allowNegative: false,
  decimal: '.',
  precision: 2,
  prefix: '',
  suffix: '',
  thousands: ','
};

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    ConsoleComponent,
    OverviewComponent,
    TopBarComponent,
    SignInComponent,
    RegisterComponent,
    ProjectCardComponent,
    MaterialElevationDirective,
    NewProjectComponent,
    ProjectSidenavComponent,
    WebapiComponent,
    TruncateAddressPipe,
    TurtleAmountPipe,
    AccountOptionsComponent,
    DepositComponent,
    GetStartedNodeComponent,
    GetStartedUnityComponent,
    GetStartedHttpComponent,
    ViewSecretDialogComponent,
    AccountManagementComponent,
    DepositsViewComponent,
    DepositDetailsComponent,
    DepositDetailsDialogComponent,
    SetAddressDialogComponent,
    TransferDialogComponent,
    WithdrawDialogComponent,
    WithdrawalsViewComponent,
    TransfersViewComponent,
    EditStringDialogComponent,
    SetWebhookDialogComponent,
    GettingStartedComponent,
    CopyStringBoxComponent,
    WithdrawalDetailsDialogComponent,
    WithdrawalDetailsComponent,
    AccountDetailsDialogComponent,
    TransferDetailsDialogComponent,
    SupportComponent,
    RecipientFormComponent,
    SearchBoxComponent,
    WebhooksComponent,
    PasswordRecoveryDialogComponent,
    DocumentationComponent,
    AdminComponent,
    UserProfileComponent,
    WithdrawalInspectorComponent,
    GenericObjectInspectorComponent,
    DepositInspectorComponent,
    ServiceChargeManagementComponent,
    ConfigManagementComponent,
    NodeManagementComponent
  ],
  entryComponents: [
    AccountDetailsDialogComponent,
    ViewSecretDialogComponent,
    DepositDetailsDialogComponent,
    WithdrawalDetailsDialogComponent,
    TransferDetailsDialogComponent,
    SetAddressDialogComponent,
    TransferDialogComponent,
    WithdrawDialogComponent,
    EditStringDialogComponent,
    SetWebhookDialogComponent,
    PasswordRecoveryDialogComponent
  ],
  imports: [
    BrowserModule,
    FormsModule,
    ReactiveFormsModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    FlexLayoutModule,
    MaterialModule,
    HttpClientModule,
    AngularFireModule.initializeApp(environment.firebase),
    AngularFireFunctionsModule,
    AngularFireAuthModule,
    AngularFirestoreModule,
    ClipboardModule,
    CurrencyMaskModule
  ],
  providers: [
    AuthService,
    ConsoleService,
    AdminService,
    DialogService,
    AngularFireAuthGuard,
    { provide: CURRENCY_MASK_CONFIG, useValue: CustomCurrencyMaskConfig }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
