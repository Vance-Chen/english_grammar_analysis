import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode, type TouchEvent } from "react";
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
  annotationBundleSchema,
  validateAnnotationSemantics,
  type SpanAnnotation,
  type StreamEvent,
} from "./lib/schema";
import { AnnotationPopover } from "./components/AnnotationPopover";
import { ReviewPanel, type EvaluationPayload } from "./components/ReviewPanel";
import { useI18n, type Locale } from "./i18n";
import { getSelectionViewportRect, selectionUtf16Offsets } from "./lib/selection";
import { buildTextSegments } from "./lib/sentenceSegments";
import { randomId } from "./lib/randomId";

const defaultText = "He left.";
const POPOVER_W = 360;
const POPOVER_MAX_H = 520;

type DraftGf = (typeof GRAMMATICAL_FUNCTION)[number] | "";
type DraftFc = (typeof FORM_CATEGORY)[number] | "";

function clampPopoverPosition(rect: { left: number; top: number; bottom: number; width: number; height: number }) {
  let left = rect.left;
  let top = rect.bottom + 6;
  if (left + POPOVER_W > window.innerWidth - 8) left = window.innerWidth - POPOVER_W - 8;
  if (left < 8) left = 8;
  if (top + POPOVER_MAX_H > window.innerHeight - 8) {
    top = Math.max(8, rect.top - POPOVER_MAX_H - 6);
  }
  if (top < 8) top = 8;
  return { top, left };
}

function newSpan(
  partial: Pick<SpanAnnotation, "start" | "end"> & Partial<Omit<SpanAnnotation, "start" | "end">>
): SpanAnnotation {
  return {
    id: randomId(),
    grammaticalFunction: partial.grammaticalFunction ?? "O",
    formCategory: partial.formCategory ?? "other",
    clauseSubtype: partial.clauseSubtype,
    subordinatorHint: partial.subordinatorHint,
    parentSpanId: partial.parentSpanId,
    notes: partial.notes,
    start: partial.start,
    end: partial.end,
  };
}

export default function App() {
  const { t, enumLabel, locale, setLocale } = useI18n();
  const [text, setText] = useState(defaultText);
  const sentenceRef = useRef<HTMLDivElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const [draftRange, setDraftRange] = useState<{ start: number; end: number } | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 80, left: 16 });

  const [grammaticalFunction, setGrammaticalFunction] = useState<DraftGf>("");
  const [formCategory, setFormCategory] = useState<DraftFc>("");
  const [clauseSubtype, setClauseSubtype] = useState<(typeof CLAUSE_SUBTYPE)[number] | "">("");
  const [subordinatorHint, setSubordinatorHint] = useState<(typeof SUBORDINATOR_HINT)[number] | "">("");
  const [parentSpanId, setParentSpanId] = useState("");
  const [sentenceClass, setSentenceClass] = useState<(typeof SENTENCE_CLASS)[number]>("declarative");
  const [structureType, setStructureType] = useState<(typeof STRUCTURE_TYPE)[number]>("simple");
  const [verbTense, setVerbTense] = useState<(typeof VERB_TENSE)[number]>("past_simple");
  const [verbVoice, setVerbVoice] = useState<(typeof VERB_VOICE)[number]>("active");
  const [specialPatterns, setSpecialPatterns] = useState<(typeof SPECIAL_PATTERN)[number][]>(["none"]);
  const [spans, setSpans] = useState<SpanAnnotation[]>([
    newSpan({ start: 0, end: 2, grammaticalFunction: "S", formCategory: "np" }),
    newSpan({ start: 3, end: 7, grammaticalFunction: "V", formCategory: "vp" }),
  ]);

  const [clientErrors, setClientErrors] = useState<string[]>([]);
  const [clientWarnings, setClientWarnings] = useState<string[]>([]);
  const [streamLog, setStreamLog] = useState("");
  const [translation, setTranslation] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [mobileReviewOpen, setMobileReviewOpen] = useState(false);
  const [annotationFormError, setAnnotationFormError] = useState("");

  const resetAnnotationDraft = useCallback(() => {
    setGrammaticalFunction("");
    setFormCategory("");
    setClauseSubtype("");
    setSubordinatorHint("");
    setParentSpanId("");
    setAnnotationFormError("");
  }, []);

  const openPopoverAt = useCallback((rect: { left: number; top: number; bottom: number; width: number; height: number }) => {
    const p = clampPopoverPosition(rect);
    setPopoverPos(p);
    resetAnnotationDraft();
    setPopoverOpen(true);
  }, [resetAnnotationDraft]);

  const handleSentenceMouseUp = useCallback(
    (e: MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(".annot-chip__remove")) return;
      const root = sentenceRef.current;
      if (!root) return;
      const off = selectionUtf16Offsets(root);
      if (!off) {
        setDraftRange(null);
        setPopoverOpen(false);
        return;
      }
      setDraftRange(off);
      const vrect = getSelectionViewportRect(root);
      if (vrect && vrect.width >= 0) {
        openPopoverAt(vrect);
      } else {
        resetAnnotationDraft();
        setPopoverPos({ top: 100, left: 24 });
        setPopoverOpen(true);
      }
    },
    [openPopoverAt, resetAnnotationDraft]
  );

  const handleSentenceTouchEnd = useCallback(
    (e: TouchEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest(".annot-chip__remove")) return;
      const touch = e.changedTouches[0];
      window.setTimeout(() => {
        const root = sentenceRef.current;
        if (!root) return;
        const off = selectionUtf16Offsets(root);
        if (!off) {
          setDraftRange(null);
          setPopoverOpen(false);
          return;
        }
        setDraftRange(off);
        const vrect = getSelectionViewportRect(root);
        if (vrect && vrect.width >= 0) {
          openPopoverAt(vrect);
        } else if (touch) {
          resetAnnotationDraft();
          let left = touch.clientX - POPOVER_W / 2;
          let top = touch.clientY + 12;
          if (left + POPOVER_W > window.innerWidth - 8) left = window.innerWidth - POPOVER_W - 8;
          if (left < 8) left = 8;
          if (top + POPOVER_MAX_H > window.innerHeight - 8) top = Math.max(8, touch.clientY - POPOVER_MAX_H - 8);
          setPopoverPos({ top, left });
          setPopoverOpen(true);
        }
      }, 80);
    },
    [openPopoverAt, resetAnnotationDraft]
  );

  const dismissPopover = useCallback(() => {
    setPopoverOpen(false);
    setAnnotationFormError("");
    window.getSelection()?.removeAllRanges();
  }, []);

  useEffect(() => {
    if (!popoverOpen) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") dismissPopover();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [popoverOpen, dismissPopover]);

  useEffect(() => {
    if (!popoverOpen) return;
    const onDocMouseDown = (ev: globalThis.MouseEvent) => {
      const target = ev.target as Node;
      if (popoverRef.current?.contains(target)) return;
      if (sentenceRef.current?.contains(target)) return;
      dismissPopover();
    };
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [popoverOpen, dismissPopover]);

  const addSpan = useCallback(() => {
    if (!draftRange) return;
    if (grammaticalFunction === "" || formCategory === "") return;
    const span = newSpan({
      start: draftRange.start,
      end: draftRange.end,
      grammaticalFunction,
      formCategory,
      clauseSubtype: clauseSubtype || undefined,
      subordinatorHint: subordinatorHint || undefined,
      parentSpanId: parentSpanId.trim() || undefined,
    });
    setSpans((s) => [...s, span]);
    setDraftRange(null);
  }, [draftRange, grammaticalFunction, formCategory, clauseSubtype, subordinatorHint, parentSpanId]);

  const confirmAnnotation = useCallback(() => {
    if (grammaticalFunction === "" || formCategory === "") {
      setAnnotationFormError(t("popover.errRequired"));
      return;
    }
    setAnnotationFormError("");
    addSpan();
    setPopoverOpen(false);
    window.getSelection()?.removeAllRanges();
  }, [addSpan, grammaticalFunction, formCategory, t]);

  const removeSpan = (id: string) => setSpans((s) => s.filter((x) => x.id !== id));

  const buildBundle = useCallback(() => {
    const bundle = {
      taxonomyVersion: TAXONOMY_VERSION,
      text,
      indexEncoding: INDEX_ENCODING,
      sentencePatterns: {
        sentenceClass,
        structureType,
        specialPatterns,
        verbTense,
        verbVoice,
      },
      spans,
      metadata: { clientVersion: "web-1.0.0" },
    };
    return annotationBundleSchema.safeParse(bundle);
  }, [text, sentenceClass, structureType, verbTense, verbVoice, specialPatterns, spans]);

  const validateClient = useCallback(() => {
    const parsed = buildBundle();
    if (!parsed.success) {
      setClientErrors([JSON.stringify(parsed.error.flatten(), null, 2)]);
      setClientWarnings([]);
      return;
    }
    const sem = validateAnnotationSemantics(parsed.data);
    setClientErrors(sem.errors);
    setClientWarnings(sem.warnings);
  }, [buildBundle]);

  const toggleSpecial = (p: (typeof SPECIAL_PATTERN)[number]) => {
    setSpecialPatterns((prev) => {
      if (p === "none") return ["none"];
      const withoutNone = prev.filter((x) => x !== "none");
      if (withoutNone.includes(p)) {
        const next = withoutNone.filter((x) => x !== p);
        return next.length ? next : ["none"];
      }
      return [...withoutNone, p];
    });
  };

  const submit = async () => {
    setStreamLog("");
    setTranslation("");
    setEvaluation(null);

    const data = buildBundle();
    if (!data.success) {
      setClientErrors([JSON.stringify(data.error.flatten(), null, 2)]);
      setClientWarnings([]);
      return;
    }
    const sem = validateAnnotationSemantics(data.data);
    setClientErrors(sem.errors);
    setClientWarnings(sem.warnings);
    if (!sem.ok) return;

    setMobileReviewOpen(true);

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data.data),
      });
      if (!res.ok) {
        const bodyText = await res.text();
        setClientErrors([t("err.http", { status: res.status, text: bodyText })]);
        return;
      }
      const reader = res.body?.getReader();
      if (!reader) {
        setClientErrors([t("err.noBody")]);
        return;
      }
      const dec = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const blocks = buf.split("\n\n");
        buf = blocks.pop() ?? "";
        for (const block of blocks) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const ev = JSON.parse(line.slice(6)) as StreamEvent;
            setStreamLog((l) => l + JSON.stringify(ev) + "\n");
            if (ev.type === "translation") {
              setTranslation((prev) => prev + ev.delta);
            }
            if (ev.type === "evaluation") {
              setEvaluation(ev);
            }
            if (ev.type === "error") {
              setClientErrors((errs) => [...errs, ev.message]);
            }
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const selectedSlice =
    draftRange && draftRange.start < draftRange.end ? text.slice(draftRange.start, draftRange.end) : "";

  return (
    <div className="layout app-root">
      <header className="app-header">
        <div>
          <h1>
            {t("app.title")} <span className="app-header__sub">{t("app.subtitle")}</span>
          </h1>
        </div>
        <div className="app-header__actions">
          <button type="button" className="btn-ghost review-trigger-mb" onClick={() => setMobileReviewOpen(true)}>
            {t("review.toggleOpen")}
          </button>
          <div className="lang-switch">
            <label htmlFor="locale-select">{t("lang.label")}</label>
            <select
              id="locale-select"
              value={locale}
              onChange={(e) => setLocale(e.target.value as Locale)}
            >
              <option value="zh-CN">{t("lang.zh")}</option>
              <option value="en-US">{t("lang.en")}</option>
            </select>
          </div>
        </div>
      </header>

      <div className="app-shell">
        <main className="app-main">
          <div className="panel panel--elevated">
            <label>
              {t("input.label")}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={() => setSpans([])}
                className="input-textarea"
              />
            </label>
            <p className="hint">{t("input.hint")}</p>
          </div>

          <div className="panel panel--elevated">
            <strong className="panel__title">{t("sentence.title")}</strong>
            <p className="hint hint--mobile-tip">{t("sentence.mobileTip")}</p>
            <div
              ref={sentenceRef}
              className="sentence sentence--interactive"
              onMouseUp={handleSentenceMouseUp}
              onTouchEnd={handleSentenceTouchEnd}
            >
              {buildTextSegments(text, spans).map((seg, i) => {
                const slice = text.slice(seg.start, seg.end);
                if (seg.spans.length === 0) {
                  return <span key={`plain-${seg.start}-${seg.end}`}>{slice}</span>;
                }
                let node: ReactNode = slice;
                for (let j = seg.spans.length - 1; j >= 0; j--) {
                  const span = seg.spans[j];
                  node = (
                    <span
                      key={span.id}
                      className="annot-chip"
                      data-gf={span.grammaticalFunction}
                      title={`${enumLabel("enum.grammaticalFunction", span.grammaticalFunction)} — ${enumLabel("enum.formCategory", span.formCategory)}`}
                    >
                      <button
                        type="button"
                        className="annot-chip__remove"
                        aria-label={t("annot.remove")}
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                          removeSpan(span.id);
                        }}
                        onClick={(ev) => {
                          ev.preventDefault();
                          ev.stopPropagation();
                        }}
                      />
                      {node}
                    </span>
                  );
                }
                return (
                  <span key={`wrap-${seg.start}-${seg.end}-${i}`} className="annot-seg">
                    {node}
                  </span>
                );
              })}
            </div>
            <p className="hint hint--selection">
              {t("sentence.selection")}：{" "}
              {draftRange
                ? `[${draftRange.start},${draftRange.end}) → "${text.slice(draftRange.start, draftRange.end)}"`
                : t("sentence.selectionNone")}
            </p>
          </div>

          <div className="panel panel--elevated">
            <strong className="panel__title">{t("panel.sentenceTags")}</strong>
            <div className="row row--sentence-meta">
              <label>
                {t("label.sentenceClass")}
                <select
                  value={sentenceClass}
                  onChange={(e) => setSentenceClass(e.target.value as (typeof SENTENCE_CLASS)[number])}
                >
                  {SENTENCE_CLASS.map((g) => (
                    <option key={g} value={g}>
                      {enumLabel("enum.sentenceClass", g)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("label.structureType")}
                <select
                  value={structureType}
                  onChange={(e) => setStructureType(e.target.value as (typeof STRUCTURE_TYPE)[number])}
                >
                  {STRUCTURE_TYPE.map((g) => (
                    <option key={g} value={g}>
                      {enumLabel("enum.structureType", g)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("label.verbTense")}
                <select
                  value={verbTense}
                  onChange={(e) => setVerbTense(e.target.value as (typeof VERB_TENSE)[number])}
                >
                  {VERB_TENSE.map((g) => (
                    <option key={g} value={g}>
                      {enumLabel("enum.verbTense", g)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                {t("label.verbVoice")}
                <select
                  value={verbVoice}
                  onChange={(e) => setVerbVoice(e.target.value as (typeof VERB_VOICE)[number])}
                >
                  {VERB_VOICE.map((g) => (
                    <option key={g} value={g}>
                      {enumLabel("enum.verbVoice", g)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <p className="hint panel__subhint">{t("label.specialPatterns")}</p>
            <div className="special-pattern-grid">
              {SPECIAL_PATTERN.map((p) => (
                <label key={p}>
                  <input
                    type="checkbox"
                    checked={specialPatterns.includes(p)}
                    onChange={() => toggleSpecial(p)}
                  />
                  {enumLabel("enum.specialPattern", p)}
                </label>
              ))}
            </div>
          </div>

          <div className="panel panel--elevated panel--submit-strip">
            <div className="row row--actions">
              <button type="button" className="secondary" onClick={validateClient}>
                {t("btn.validate")}
              </button>
              <button type="button" className="btn-primary" onClick={submit} disabled={loading}>
                {loading ? t("btn.submitting") : t("btn.submit")}
              </button>
            </div>
          </div>

          <div className="panel panel--elevated">
            <strong className="panel__title">{t("panel.addedSpans")}</strong>
            <ul className="spans-list">
              {spans.map((s) => (
                <li key={s.id}>
                  <span className="tag">
                    {t("span.range", { start: s.start, end: s.end })} {text.slice(s.start, s.end)}
                  </span>
                  <span className="spans-list__meta">
                    {enumLabel("enum.grammaticalFunction", s.grammaticalFunction)} /{" "}
                    {enumLabel("enum.formCategory", s.formCategory)}
                    {s.clauseSubtype ? ` / ${enumLabel("enum.clauseSubtype", s.clauseSubtype)}` : ""}
                    {s.parentSpanId ? ` · ${t("span.parent")}=${s.parentSpanId}` : ""}
                  </span>
                  <button type="button" className="secondary btn-sm" onClick={() => removeSpan(s.id)}>
                    {t("btn.delete")}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {(clientErrors.length > 0 || clientWarnings.length > 0) && (
            <div className="panel panel--elevated panel--messages">
              {clientErrors.length > 0 && (
                <div className="error">
                  <strong>{t("err.title")}</strong>
                  <pre>{clientErrors.join("\n")}</pre>
                </div>
              )}
              {clientWarnings.length > 0 && (
                <div className="warnings">
                  <strong>{t("warn.title")}</strong>
                  <ul>
                    {clientWarnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </main>

        {mobileReviewOpen && <div className="review-backdrop" aria-hidden onClick={() => setMobileReviewOpen(false)} />}

        <aside className={`review-sidebar ${mobileReviewOpen ? "is-open" : ""}`}>
          <div className="review-sidebar__chrome">
            <h2 className="review-sidebar__title">{t("review.title")}</h2>
            <button
              type="button"
              className="review-sidebar__close-mb"
              onClick={() => setMobileReviewOpen(false)}
              aria-label={t("review.toggleClose")}
            >
              ×
            </button>
          </div>
          <ReviewPanel evaluation={evaluation} translation={translation} streamLog={streamLog} />
        </aside>
      </div>

      <button
        type="button"
        className={`review-fab ${mobileReviewOpen ? "is-concealed" : ""}`}
        onClick={() => setMobileReviewOpen(true)}
        aria-label={t("review.toggleOpen")}
      >
        {t("review.toggleOpen")}
      </button>

      <AnnotationPopover
        ref={popoverRef}
        open={popoverOpen}
        top={popoverPos.top}
        left={popoverPos.left}
        selectedText={selectedSlice}
        grammaticalFunction={grammaticalFunction}
        setGrammaticalFunction={setGrammaticalFunction}
        formCategory={formCategory}
        setFormCategory={setFormCategory}
        clauseSubtype={clauseSubtype}
        setClauseSubtype={setClauseSubtype}
        subordinatorHint={subordinatorHint}
        setSubordinatorHint={setSubordinatorHint}
        parentSpanId={parentSpanId}
        setParentSpanId={setParentSpanId}
        fieldError={annotationFormError}
        onConfirm={confirmAnnotation}
        onDismiss={dismissPopover}
      />
    </div>
  );
}
