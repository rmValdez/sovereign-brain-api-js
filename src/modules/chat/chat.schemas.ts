import { z } from "zod";

export const EditorSelectionSchema = z.object({
  text: z.string(),
  start_line: z.number().nullable().optional(),
  end_line: z.number().nullable().optional(),
});

export const ChatRequestSchema = z.object({
  message: z.string().min(1),
  session_id: z.string().nullable().optional(),
  user_id: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  workspace_root: z.string().nullable().optional(),
  relative_file: z.string().nullable().optional(),
  language: z.string().nullable().optional(),
  selection: EditorSelectionSchema.nullable().optional(),
  timezone: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
});

export type ChatRequest = z.infer<typeof ChatRequestSchema>;

export const ChatResponseSchema = z.object({
  response: z.string(),
  session_id: z.string(),
  confirmation: z.record(z.unknown()).nullable().optional(),
  trace_id: z.string().nullable().optional(),
});

export type ChatResponse = z.infer<typeof ChatResponseSchema>;
