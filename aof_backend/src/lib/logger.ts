import pino from "pino";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  redact: {
    paths: ["req.headers.authorization", "req.headers.cookie", 'req.headers["x-admin-token"]', 'req.headers["x-api-key"]', "req.body.walletProof", "secret", "privateKey"],
    censor: "[REDACTED]",
  },
  serializers: {
    req: (request) => {
      const serialized = pino.stdSerializers.req(request);
      if (serialized.url) serialized.url = serialized.url.split("?")[0];
      return serialized;
    },
  },
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino/file", options: { destination: 1 } }
    : undefined,
  base: { service: "aof-backend" },
});
