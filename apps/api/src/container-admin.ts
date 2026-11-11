import { randomUUID } from "node:crypto";
import { AdminService, type AdminStore } from "@hkfinhub/admin";
import { AdjustmentWorkflow, type LedgerService } from "@hkfinhub/ledger";
import { PrismaAdminStore, PrismaLedgerStore, type Database } from "@hkfinhub/database";

export interface AdminServices {
  admin: AdminService;
  adminStore: AdminStore;
  adjustments: AdjustmentWorkflow;
}

export function buildAdminServices(db: Database, fieldKey: Uint8Array, ledger: LedgerService): AdminServices {
  const adminStore = new PrismaAdminStore(db);
  return {
    admin: new AdminService(adminStore, fieldKey),
    adminStore,
    adjustments: new AdjustmentWorkflow(new PrismaLedgerStore(db), ledger, () => randomUUID()),
  };
}
