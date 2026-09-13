import { Request, Response, NextFunction } from "express";
import { ZodSchema } from "zod";
import { logger } from "../lib/logger";

// Фабрика мидлвара валидации
export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      logger.warn({ path: req.path, errors: result.error.issues }, "Validation failed");
      return res.status(422).json({
        error: "Validation failed",
        issues: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    req.body = result.data;
    next();
  };
};
