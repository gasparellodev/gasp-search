import "server-only";

// ===========================================================================
// Phase 7 / Frente 04 GEO/AI — #G5
// Provider abstraction for brand mention monitoring via AI search platforms.
// ===========================================================================
//
// V1 ships MockMonitoringProvider (always cited=false) as the default.
// Future providers: PerplexityProvider, ChatGPTScraperProvider.
// Consumers receive a MonitoringProvider by DI — the script orchestrator
// decides which implementation to use based on env vars.

export type MonitoringSource = "perplexity" | "chatgpt" | "mock";

export interface MonitoringResult {
  query: string;
  source: MonitoringSource;
  cited: boolean;
  snippet: string | null;
  checked_at: Date;
}

export interface MonitoringProvider {
  readonly source: MonitoringSource;
  check(query: string, expectedDomain: string): Promise<MonitoringResult>;
}

/**
 * MockMonitoringProvider — V1 default.
 *
 * Always returns `cited: false` with a console.warn so operators know the
 * real provider is not configured. Replace with PerplexityProvider /
 * ChatGPTScraperProvider when API keys are available.
 */
export class MockMonitoringProvider implements MonitoringProvider {
  readonly source = "mock" as const;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async check(query: string, expectedDomain: string): Promise<MonitoringResult> {
    console.warn(
      "[geo-monitor] MockMonitoringProvider ativo — resultados não refletem menções reais." +
        " Configure PERPLEXITY_API_KEY ou equivalente para ativar um provider real.",
    );
    return {
      query,
      source: "mock",
      cited: false,
      snippet: null,
      checked_at: new Date(),
    };
  }
}
