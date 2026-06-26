import { z } from "zod";
import {
  CLAUSE_SUBTYPE,
  FORM_CATEGORY,
  GRAMMATICAL_FUNCTION,
  INDEX_ENCODING,
  SENTENCE_CLASS,
  SPECIAL_PATTERN,
  STRUCTURE_TYPE,
  SUBORDINATOR_HINT,
  TAXONOMY_VERSION,
  VERB_TENSE,
  VERB_VOICE,
} from "./builtin-taxonomy";

const spanSchema = z
  .object({
    id: z.string().min(1).max(64),
    start: z.number().int().min(0),
    end: z.number().int().min(0),
    grammaticalFunction: z.enum(GRAMMATICAL_FUNCTION),
    formCategory: z.enum(FORM_CATEGORY),
    clauseSubtype: z.enum(CLAUSE_SUBTYPE).optional(),
    subordinatorHint: z.enum(SUBORDINATOR_HINT).optional(),
    parentSpanId: z.string().min(1).max(64).optional(),
    notes: z.string().max(2000).optional(),
  })
  .strict();

export const annotationBundleSchema = z
  .object({
    taxonomyVersion: z.literal(TAXONOMY_VERSION),
    sentenceId: z.string().optional(),
    text: z.string().min(1).max(4000),
    normalizedText: z.string().optional(),
    indexEncoding: z.literal(INDEX_ENCODING),
    sentencePatterns: z
      .object({
        sentenceClass: z.enum(SENTENCE_CLASS),
        structureType: z.enum(STRUCTURE_TYPE),
        specialPatterns: z.array(z.enum(SPECIAL_PATTERN)).default([]),
        sentencePatternNotes: z.string().max(2000).optional(),
        verbTense: z.enum(VERB_TENSE).default("unspecified"),
        verbVoice: z.enum(VERB_VOICE).default("unspecified"),
      })
      .strict(),
    spans: z.array(spanSchema),
    metadata: z
      .object({
        clientVersion: z.string().optional(),
        sessionId: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .strict();

export type AnnotationBundle = z.infer<typeof annotationBundleSchema>;
export type SpanAnnotation = z.infer<typeof spanSchema>;
export { spanSchema };

/** 校验 span 边界与 parentSpanId 存在性；返回警告列表 */
export function validateAnnotationSemantics(
  bundle: AnnotationBundle
): { ok: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const { text, spans } = bundle;
  // utf-16 码元长度，与 JS String 索引一致
  const utf16Len = text.length;
  const ids = new Set<string>();

  for (const s of spans) {
    if (ids.has(s.id)) errors.push(`重复 span id: ${s.id}`);
    ids.add(s.id);
    if (s.start < 0 || s.end > utf16Len || s.start >= s.end) {
      errors.push(`span ${s.id}: 非法区间 [${s.start}, ${s.end})，文本 utf-16 长度 ${utf16Len}`);
    }
    if (s.parentSpanId && !spans.some((p) => p.id === s.parentSpanId)) {
      errors.push(`span ${s.id}: parentSpanId 不存在: ${s.parentSpanId}`);
    }
    if (s.formCategory === "clause" && !s.clauseSubtype) {
      warnings.push(`span ${s.id}: 从句建议填写 clauseSubtype`);
    }
  }

  const vSpans = spans.filter((s) => s.grammaticalFunction === "V");
  if (vSpans.length === 0) {
    warnings.push("未标注谓语 V；若教学规则要求可改为硬错误");
  }

  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const a = spans[i]!;
      const b = spans[j]!;
      const overlap = a.start < b.end && b.start < a.end;
      if (overlap && a.id !== b.id) {
        warnings.push(`span ${a.id} 与 ${b.id} 区间重叠`);
      }
    }
  }

  return { ok: errors.length === 0, errors, warnings };
}
