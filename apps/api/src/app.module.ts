import { DynamicModule, Module } from "@nestjs/common";
import { CONTAINER } from "./constants";
import type { Container } from "./container";
import { AuthController, MeController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { HealthController } from "./health/health.controller";
import { AccountsController, DashboardController } from "./accounts/accounts.controller";
import { KycController } from "./kyc/kyc.controller";
import { AdminController } from "./admin/admin.controller";
import { InvestmentController } from "./investment/investment.controller";
import { ConfigController, DepositsController, FxController, RequestsController, TransfersController, WebhooksController } from "./payments/payments.controller";
import { ReferenceRatesController } from "./fx/reference-rates.controller";

/** Composition root. The container is built outside Nest so tests can substitute providers. */
@Module({})
export class AppModule {
  static forRoot(container: Container): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, AuthController, MeController, AccountsController, DashboardController, DepositsController, TransfersController, FxController, ReferenceRatesController, RequestsController, WebhooksController, ConfigController, KycController, AdminController, InvestmentController],
      providers: [
        { provide: CONTAINER, useValue: container },
        AuthGuard,
      ],
    };
  }
}
