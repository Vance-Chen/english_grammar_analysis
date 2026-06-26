import type { SpanAnnotation } from "./schema";

/** 将 [start,end) 区间按所有 span 边界切分；每段列出覆盖该段的 span（按长度升序，便于由内到外嵌套渲染）。 */
export function buildTextSegments(text: string, spans: SpanAnnotation[]): { start: number; end: number; spans: SpanAnnotation[] }[] {
  const n = text.length;
  const bounds = new Set<number>([0, n]);
  for (const s of spans) {
    const a = Math.max(0, Math.min(s.start, n));
    const b = Math.max(0, Math.min(s.end, n));
    if (a < b) {
      bounds.add(a);
      bounds.add(b);
    }
  }
  const sorted = [...bounds].sort((x, y) => x - y);
  const out: { start: number; end: number; spans: SpanAnnotation[] }[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const start = sorted[i];
    const end = sorted[i + 1];
    if (start >= end) continue;
    const covering = spans.filter((s) => {
      const a = Math.max(0, Math.min(s.start, n));
      const b = Math.max(0, Math.min(s.end, n));
      return a < end && b > start;
    });
    covering.sort((a, b) => a.end - a.start - (b.end - b.start) || a.start - b.start);
    out.push({ start, end, spans: covering });
  }
  return out;
}
