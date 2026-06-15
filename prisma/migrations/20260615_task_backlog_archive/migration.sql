-- Add backlog (before todo) and archived (after done) to the task workflow.
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'backlog' BEFORE 'todo';
ALTER TYPE "TaskStatus" ADD VALUE IF NOT EXISTS 'archived' AFTER 'done';
