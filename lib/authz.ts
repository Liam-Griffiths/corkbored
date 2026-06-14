import { auth } from "./auth";
import { prisma } from "./db";

export class AuthError extends Error {
  constructor(
    public readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new AuthError(401, "Sign in required");
  }
  return session.user;
}

export async function requireProjectOwner(projectId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!membership || membership.role !== "owner" || membership.leftAt) {
    throw new AuthError(403, "Project owner access required");
  }
  return user;
}

export async function requireProjectMember(projectId: string) {
  const user = await requireUser();
  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  });
  if (!membership || membership.leftAt) {
    throw new AuthError(403, "Project member access required");
  }
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (!dbUser?.isAdmin) {
    throw new AuthError(403, "Admin access required");
  }
  return user;
}
