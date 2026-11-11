import { Controller, Get } from "@nestjs/common";
import { getReferenceRates } from "./reference-rates";

/** Public reference rates for display. Contains no customer data, so it needs no login. */
@Controller("fx")
export class ReferenceRatesController {
  @Get("reference-rates")
  async referenceRates() {
    return getReferenceRates();
  }
}
