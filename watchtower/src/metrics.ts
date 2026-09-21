/**
 * Prometheus metrics + optional Sentry / OpenTelemetry / Redis.
 * Everything optional is behind an env flag and fails open: the exporter
 * must keep serving read-only data even when observability backends are down.
 */
import client from "prom-client";

client.collectDefaultMetrics({ prefix: "aof_watchtower_" });
export const requests = new client.Counter({ name: "aof_watchtower_requests_total", help: "exporter requests", labelNames: ["path", "status"] });
export const latency = new client.Histogram({ name: "aof_watchtower_request_seconds", help: "exporter latency", labelNames: ["path"], buckets: [0.01, 0.05, 0.1, 0.5, 1, 5] });
export const lagGauge = new client.Gauge({ name: "aof_watchtower_finalized_lag_slots", help: "chain finalized slot minus newest indexed slot" });

export function recordRequest(path: string, status: number, ms: number) {
  requests.inc({ path, status: String(status) });
  latency.observe({ path }, ms / 1000);
}

export function initTelemetry(serviceName: string) {
  let sentry: any = null;
  let otel: any = null;
  let redis: any = null;

  if (process.env.SENTRY_DSN) {
    try { sentry = require("@sentry/node"); sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV ?? "development", release: process.env.GIT_SHA }); }
    catch (e) { console.warn("[watchtower-exporter] Sentry unavailable:", (e as Error).message); sentry = null; }
  }
  if (process.env.OTEL_EXPORTER_OTLP_ENDPOINT || process.env.OTEL_ENABLED === "true") {
    try {
      const { NodeSDK } = require("@opentelemetry/sdk-node");
      otel = new NodeSDK({ serviceName });
      otel.start();
    } catch (e) { console.warn("[watchtower-exporter] OpenTelemetry unavailable:", (e as Error).message); otel = null; }
  }
  if (process.env.REDIS_URL) {
    // Reserved for response caching when a second exporter instance exists;
    // today it is only a connectivity probe reported in /readyz.
    try { const Redis = require("ioredis"); redis = new Redis(process.env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 }); redis.connect().catch(() => undefined); }
    catch (e) { console.warn("[watchtower-exporter] Redis unavailable:", (e as Error).message); redis = null; }
  }

  return {
    captureException: (e: unknown) => { try { sentry?.captureException(e); } catch { /* fail open */ } console.error("[watchtower-exporter]", e); },
    shutdown: async () => { try { await otel?.shutdown(); } catch { /* ignore */ } try { await sentry?.close(2000); } catch { /* ignore */ } try { redis?.disconnect(); } catch { /* ignore */ } },
  };
}
