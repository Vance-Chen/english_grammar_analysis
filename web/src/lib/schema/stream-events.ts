import { z } from "zod";

const progressEvent = z
  .object({
    type: z.literal("progress"),
    stage: z.enum(["validated", "llm_started"]),
    message: z.string().optional(),
  })
  .strict();

const evaluationEvent = z
  .object({
    type: z.literal("evaluation"),
    overallScore: z.number().min(0).max(100),
    dimensions: z.array(
      z
        .object({
          name: z.string(),
          score: z.number().min(0).max(100),
          comment: z.string(),
        })
        .strict()
    ),
    differences: z
      .array(
        z
          .object({
            spanId: z.string().optional(),
            issue: z.string(),
            suggestion: z.string().optional(),
          })
          .strict()
      )
      .optional(),
    summary: z.string().optional(),
  })
  .strict();

const translationEvent = z
  .object({
    type: z.literal("translation"),
    /** 增量片段；前端可拼接 */
    delta: z.string(),
    done: z.boolean().optional(),
  })
  .strict();

const doneEvent = z
  .object({
    type: z.literal("done"),
    full: z
      .object({
        evaluation: z.unknown(),
        translationZh: z.string(),
        usage: z
          .object({
            promptTokens: z.number().optional(),
            completionTokens: z.number().optional(),
          })
          .optional(),
      })
      .strict(),
  })
  .strict();

const errorEvent = z
  .object({
    type: z.literal("error"),
    code: z.string(),
    message: z.string(),
  })
  .strict();

export const streamEventSchema = z.discriminatedUnion("type", [
  progressEvent,
  evaluationEvent,
  translationEvent,
  doneEvent,
  errorEvent,
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;
export type ProgressEvent = z.infer<typeof progressEvent>;
export type EvaluationEvent = z.infer<typeof evaluationEvent>;
export type TranslationEvent = z.infer<typeof translationEvent>;
export type DoneEvent = z.infer<typeof doneEvent>;
