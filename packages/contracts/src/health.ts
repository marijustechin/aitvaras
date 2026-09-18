import { z } from "zod";

/**
 * Response contract for `GET /health` on the Aitvaras API.
 *
 * This is the first real shared contract between the API and any consumer.
 * It is deliberately small; extend it only when a real shared need exists.
 */
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("aitvaras-api"),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;
