import { Request, Response, NextFunction } from "express";
import { logger } from "../lib/logger";

export const errorHandler = (
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  logger.error({ err, path: req.path, method: req.method }, "Unhandled error");

  if (res.headersSent) return;

  const status = err.status || err.statusCode || 500;
  const message = err.expose ? err.message : "Internal server error";

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
};

// Обёртка для асинхронных роутов (чтобы не писать try/catch везде)
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
