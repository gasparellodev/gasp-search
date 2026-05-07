import "server-only";
import { ApifyClient } from "apify-client";
import { env } from "@/lib/env";

// Singleton — barato de criar mas reusamos por consistência (token único).
let _apify: ApifyClient | null = null;

export function getApify(): ApifyClient {
  if (!_apify) {
    _apify = new ApifyClient({ token: env.APIFY_TOKEN });
  }
  return _apify;
}
