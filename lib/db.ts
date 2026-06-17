import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/prisma/client";

function dbUrl(): string {
  if (process.env.DB_ENV === "dev") {
    return process.env.DATABASE_URL_DEV ?? process.env.DATABASE_URL!;
  }
  return process.env.DATABASE_URL!;
}

function createPrismaClient() {
  // Neon auto-suspends idle compute (which keeps cost down). When it does, any
  // pooled sockets we're holding go dead and the next query fails with P1001.
  // Closing idle connections well before Neon's suspend window means we never
  // reuse a dead socket — a new request just opens a fresh connection, which
  // transparently wakes the compute (a few seconds on a cold hit). We
  // deliberately don't keep connections warm, since that would prevent suspend
  // and cost more.
  const adapter = new PrismaPg({
    connectionString: dbUrl(),
    idleTimeoutMillis: 10_000,
  });
  return new PrismaClient({ adapter });
}

// Singleton in development to avoid too many connections during hot reload
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
