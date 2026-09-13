import { PrismaClient } from "@prisma/client";

// Singleton Prisma клиент
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? new PrismaClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

// Алиас для совместимости с secretStore
export const prisma = db;
