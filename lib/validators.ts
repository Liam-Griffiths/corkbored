import { z } from "zod";

export const CreateProjectSchema = z.object({
  title: z.string().min(1).max(80),
  pitch: z.string().max(280).optional(),
  repoFullName: z.string().regex(/^[\w.-]+\/[\w.-]+$/, "Must be owner/repo format"),
  stage: z.enum(["building", "prototype", "launched"]),
  tags: z.array(z.string().min(1).max(30)).min(1).max(6),
});

export const PatchProjectSchema = z.object({
  title: z.string().min(1).max(80).optional(),
  pitch: z.string().max(280).optional(),
  stage: z.enum(["building", "prototype", "launched"]).optional(),
  overview: z.string().max(20000).nullable().optional(),
  tags: z.array(z.string().min(1).max(30)).min(1).max(6).optional(),
});

export const CreateRoleSchema = z.object({
  title: z.string().min(1).max(80),
  detail: z.string().max(280).optional(),
});

export const CreateApplicationSchema = z.object({
  pitch: z.string().min(20).max(500),
});

export const CreateInviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(["member", "maintainer"]).optional(),
});

export const PatchApplicationSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(120),
  summary: z.string().max(280).optional(),
  body: z.string().min(1).max(5000),
  kind: z.enum(["update", "release", "roles_open", "milestone"]),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(120),
  status: z.enum(["backlog", "todo", "doing", "done", "archived"]).optional(),
});

export const PatchTaskSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  description: z.string().max(10000).nullable().optional(),
  status: z.enum(["backlog", "todo", "doing", "done", "archived"]).optional(),
  assigneeId: z.string().nullable().optional(),
  position: z.number().optional(),
  tags: z.array(z.string().max(30)).max(10).optional(),
});

export const CreateMessageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

export const PatchMessageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  body: z.string().min(1).max(5000).optional(),
});

export const CreateEventSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).optional(),
  location: z.string().max(200).optional(),
  startAt: z.string().datetime({ offset: true }),
  endAt: z.string().datetime({ offset: true }).optional().nullable(),
  allDay: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const PatchEventSchema = CreateEventSchema.partial();

export const CreateReportSchema = z.object({
  subjectType: z.enum(["project", "application", "announcement", "tag"]),
  subjectId: z.string(),
  reason: z.string().min(10).max(500),
});

export const BoardQuerySchema = z.object({
  q: z.string().optional(),
  tag: z.string().optional(),
  stage: z.enum(["building", "prototype", "launched"]).optional(),
  sort: z.enum(["latest", "trending", "popular"]).optional(),
  cursor: z.string().optional(),
});
