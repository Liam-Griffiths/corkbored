import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { ChatPanel } from "@/components/ChatPanel";

const CHAT_ENABLED = process.env.CHAT_ENABLED === "true";
const CHAT_TRANSPORT = (process.env.CHAT_TRANSPORT ?? "polling") as "polling" | "websocket";
const CHAT_WS_URL = process.env.CHAT_WS_URL ?? null;

export default async function ChatPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const session = await auth();

  if (!CHAT_ENABLED) redirect(`/p/${slug}`);
  if (!session?.user?.id) redirect(`/api/auth/signin?callbackUrl=/p/${slug}/chat`);

  const project = await prisma.project.findUnique({
    where: { slug },
    select: { id: true, moderationStatus: true },
  });
  if (!project || project.moderationStatus === "removed") notFound();

  const membership = await prisma.membership.findUnique({
    where: { projectId_userId: { projectId: project.id, userId: session.user.id } },
    select: { leftAt: true },
  });
  if (!membership || membership.leftAt) redirect(`/p/${slug}`);

  return (
    <div className="h-[calc(100vh-290px)] min-h-[480px]">
      <ChatPanel
        slug={slug}
        currentUserId={session.user.id}
        transport={CHAT_TRANSPORT}
        wsUrl={CHAT_WS_URL}
        fullHeight
      />
    </div>
  );
}
