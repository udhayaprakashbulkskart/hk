import { DynamicModule, Module } from "@nestjs/common";
import { CONTAINER } from "./constants";
import type { Container } from "./container";
import { AuthController, MeController } from "./auth/auth.controller";
import { AuthGuard } from "./auth/auth.guard";
import { HealthController } from "./health/health.controller";
import { AccountsController, DashboardController } from "./accounts/accounts.controller";
import { ConfigController, DepositsController, FxController, RequestsController, TransfersController, WebhooksController } from "./payments/payments.controller";

/** Composition root. The container is built outside Nest so tests can substitute providers. */
@Module({})
export class AppModule {
  static forRoot(container: Container): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, AuthController, MeController, AccountsController, DashboardController, DepositsController, TransfersController, FxController, RequestsController, WebhooksController, ConfigController],
      providers: [
        { provide: CONTAINER, useValue: container },
        AuthGuard,
      ],
    };
  }
}
