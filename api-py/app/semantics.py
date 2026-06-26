"""与 TypeScript validateAnnotationSemantics 对齐。"""

from __future__ import annotations

from .models import AnnotationBundle, SpanAnnotation


def validate_annotation_semantics(bundle: AnnotationBundle) -> tuple[bool, list[str], list[str]]:
    errors: list[str] = []
    warnings: list[str] = []
    text = bundle.text
    spans: list[SpanAnnotation] = bundle.spans
    utf16_len = len(text)
    ids: set[str] = set()

    for s in spans:
        if s.id in ids:
            errors.append(f"重复 span id: {s.id}")
        ids.add(s.id)
        if s.start < 0 or s.end > utf16_len or s.start >= s.end:
            errors.append(
                f"span {s.id}: 非法区间 [{s.start}, {s.end})，文本 utf-16 长度 {utf16_len}"
            )
        if s.parent_span_id and not any(p.id == s.parent_span_id for p in spans):
            errors.append(f"span {s.id}: parentSpanId 不存在: {s.parent_span_id}")
        if s.form_category == "clause" and not s.clause_subtype:
            warnings.append(f"span {s.id}: 从句建议填写 clauseSubtype")

    v_spans = [s for s in spans if s.grammatical_function == "V"]
    if not v_spans:
        warnings.append("未标注谓语 V；若教学规则要求可改为硬错误")

    for i, a in enumerate(spans):
        for b in spans[i + 1 :]:
            overlap = a.start < b.end and b.start < a.end
            if overlap and a.id != b.id:
                warnings.append(f"span {a.id} 与 {b.id} 区间重叠")

    return (len(errors) == 0, errors, warnings)
