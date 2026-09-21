import { Test } from "@nestjs/testing";
import {
  FastifyAdapter,
  type NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { AppModule } from "../../src/app.module";
import { configureApp } from "../../src/bootstrap";
import { applyTestDatabaseEnv } from "./test-db";

/**
 * Build a real Nest application (Fastify) wired the same way as the runtime
 * entrypoint (cookie parsing + credentialed CORS) for integration tests.
 *
 * Before the app is created, the process is pointed at the dedicated test
 * database (asserted), so the app can never touch the development database.
 */
export async function createTestApp(): Promise<NestFastifyApplication> {
  applyTestDatabaseEnv();

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication<NestFastifyApplication>(
    new FastifyAdapter(),
  );
  await configureApp(app);
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
