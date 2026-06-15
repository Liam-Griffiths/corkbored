import { prisma } from "@/lib/db";

const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function randomCode(len = 6): string {
  let s = "";
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  for (const b of arr) s += CHARS[b % CHARS.length];
  return s;
}

export async function getOrCreateProjectShortlink(projectId: string): Promise<string> {
  const existing = await prisma.shortLink.findFirst({
    where: { target: "project", projectId },
  });
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await prisma.shortLink.create({ data: { code, target: "project", projectId } });
      return code;
    } catch {
      // collision — retry
    }
  }
  throw new Error("Could not generate unique shortlink");
}

export async function getOrCreateUserShortlink(userId: string): Promise<string> {
  const existing = await prisma.shortLink.findFirst({
    where: { target: "user", userId },
  });
  if (existing) return existing.code;

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await prisma.shortLink.create({ data: { code, target: "user", userId } });
      return code;
    } catch {
      // collision — retry
    }
  }
  throw new Error("Could not generate unique shortlink");
}
