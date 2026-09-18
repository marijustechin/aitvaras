import { Controller, Get } from "@nestjs/common";
import { type HealthResponse } from "@aitvaras/contracts";
import { Public } from "../../common/decorators/public.decorator";

@Controller("health")
export class HealthController {
  @Public()
  @Get()
  getHealth(): HealthResponse {
    return { status: "ok", service: "aitvaras-api" };
  }
}
