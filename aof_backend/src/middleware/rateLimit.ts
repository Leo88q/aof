import rateLimit from "express-rate-limit";

// Общий лимит: 300 запросов / 15 мин
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, slow down" },
});

// Строгий лимит для транзакционных эндпоинтов: 30 / мин
export const txLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many transactions, wait a minute" },
});

// Лимит для чтения: 1000 / 15 мин
export const readLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Read limit exceeded" },
});
