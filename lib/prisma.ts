import { PrismaLibSql } from "@prisma/adapter-libsql";
import { PrismaClient } from "@/app/generated/prisma/client";
import path from "node:path";

const rawUrl = process.env["DATABASE_URL"] ?? `file:./dev.db`;
const dbUrl =
  rawUrl.startsWith("file:./") || rawUrl.startsWith("file:../")
    ? `file:${path.resolve(rawUrl.replace(/^file:/, ""))}`
    : rawUrl;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter: new PrismaLibSql({ url: dbUrl }) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
