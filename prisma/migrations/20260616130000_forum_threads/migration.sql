-- Forum upgrade: thread titles, pinning, edit tracking, and post votes.

-- AlterTable
ALTER TABLE "Message" ADD COLUMN "title" TEXT;
ALTER TABLE "Message" ADD COLUMN "pinnedAt" TIMESTAMP(3);
ALTER TABLE "Message" ADD COLUMN "editedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "PostVote" (
    "messageId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PostVote_pkey" PRIMARY KEY ("messageId", "userId")
);

-- CreateIndex
CREATE INDEX "PostVote_messageId_idx" ON "PostVote"("messageId");

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostVote" ADD CONSTRAINT "PostVote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
