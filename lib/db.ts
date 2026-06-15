import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

function dbUrl(): string {
  if (process.env.DB_ENV === "dev") {
    return process.env.DATABASE_URL_DEV ?? process.env.DATABASE_URL!;
  }
  return process.env.DATABASE_URL!;
}

function createPrismaClient() {
  const adapter = new PrismaPg({ connectionString: dbUrl() });
  return new PrismaClient({ adapter });
}

// Singleton in development to avoid too many connections during hot reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
