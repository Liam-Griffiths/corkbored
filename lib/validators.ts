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
  tags: z.array(z.string().min(1).max(30)).min(1).max(6).optional(),
});

export const CreateRoleSchema = z.object({
  title: z.string().min(1).max(80),
  detail: z.string().max(280).optional(),
});

export const CreateApplicationSchema = z.object({
  pitch: z.string().min(20).max(500),
});

export const PatchApplicationSchema = z.object({
  status: z.enum(["accepted", "declined"]),
});

export const CreateAnnouncementSchema = z.object({
  title: z.string().min(1).max(120),
  body: z.string().min(1).max(5000),
  kind: z.enum(["update", "release", "roles_open", "milestone"]),
});

export const CreateTaskSchema = z.object({
  title: z.string().min(1).max(120),
});

export const PatchTaskSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  status: z.enum(["todo", "doing", "done"]).optional(),
  assigneeId: z.string().nullable().optional(),
  position: z.number().optional(),
});

export const CreateMessageSchema = z.object({
  body: z.string().min(1).max(5000),
  parentId: z.string().optional(),
});

export const CreateReportSchema = z.object({
  subjectType: z.enum(["project", "application", "announcement"]),
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
