import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1, "タイトルは必須です"),
  description: z.string().optional().nullable(),
  column_id: z.string().uuid(),
  assignee_ids: z.array(z.string().uuid()).optional().default([]),
  reviewer_id: z.string().uuid().optional().nullable(),
  priority: z.enum(["low", "medium", "high"]).default("medium"),
  due_date: z.string().optional().nullable(),
  tags: z.array(z.string()).optional().default([]),
  sync_calendar: z.boolean().optional().default(true),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  column_id: z.string().uuid().optional(),
  assignee_ids: z.array(z.string().uuid()).optional(),
  reviewer_id: z.union([z.string().uuid(), z.literal(""), z.null()]).optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  due_date: z.string().optional().nullable(),
  position: z.number().int().optional(),
  tags: z.array(z.string()).optional(),
  sync_calendar: z.boolean().optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
