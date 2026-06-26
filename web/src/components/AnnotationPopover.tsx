import { forwardRef } from "react";
import {
  CLAUSE_SUBTYPE,
  FORM_CATEGORY,
  GRAMMATICAL_FUNCTION,
  SUBORDINATOR_HINT,
} from "../lib/schema";
import { useI18n } from "../i18n";
import { allowedFormCategoriesForGrammaticalFunction } from "../lib/annotationLinkage";

type Gf = (typeof GRAMMATICAL_FUNCTION)[number];
type Fc = (typeof FORM_CATEGORY)[number];
type Cs = (typeof CLAUSE_SUBTYPE)[number];
type Sh = (typeof SUBORDINATOR_HINT)[number];

export type AnnotationPopoverProps = {
  open: boolean;
  top: number;
  left: number;
  selectedText: string;
  grammaticalFunction: Gf | "";
  setGrammaticalFunction: (v: Gf | "") => void;
  formCategory: Fc | "";
  setFormCategory: (v: Fc | "") => void;
  clauseSubtype: Cs | "";
  setClauseSubtype: (v: Cs | "") => void;
  subordinatorHint: Sh | "";
  setSubordinatorHint: (v: Sh | "") => void;
  parentSpanId: string;
  setParentSpanId: (v: string) => void;
  fieldError?: string;
  onConfirm: () => void;
  onDismiss: () => void;
};

export const AnnotationPopover = forwardRef<HTMLDivElement, AnnotationPopoverProps>(
  function AnnotationPopover(props, ref) {
    const { t, enumLabel } = useI18n();
    const {
      open,
      top,
      left,
      selectedText,
      grammaticalFunction,
      setGrammaticalFunction,
      formCategory,
      setFormCategory,
      clauseSubtype,
      setClauseSubtype,
      subordinatorHint,
      setSubordinatorHint,
      parentSpanId,
      setParentSpanId,
      fieldError,
      onConfirm,
      onDismiss,
    } = props;

    if (!open) return null;

    const showClauseFields = formCategory === "clause";
    const allowedFormCategories = allowedFormCategoriesForGrammaticalFunction(grammaticalFunction);
    const formSelectDisabled = grammaticalFunction === "";

    const onGrammaticalFunctionChange = (v: Gf | "") => {
      setGrammaticalFunction(v);
      const allowed = allowedFormCategoriesForGrammaticalFunction(v);
      if (formCategory && !allowed.includes(formCategory)) {
        setFormCategory("");
        setClauseSubtype("");
        setSubordinatorHint("");
      }
    };

    return (
      <>
        <div
          className="annotation-popover-backdrop"
          aria-hidden
          onMouseDown={onDismiss}
          onWheel={(e) => e.stopPropagation()}
        />
        <div
          ref={ref}
          className="annotation-popover"
          role="dialog"
          aria-modal="true"
          aria-labelledby="annotation-popover-title"
          style={{ top, left }}
          onMouseDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div className="annotation-popover__head">
            <h2 id="annotation-popover-title" className="annotation-popover__title">
              {t("popover.title")}
            </h2>
            <button type="button" className="annotation-popover__close" onClick={onDismiss} aria-label={t("popover.btnDismiss")}>
              ×
            </button>
          </div>
          <div className="annotation-popover__scroll">
            <p className="annotation-popover__selection">「{selectedText}」</p>
            <p className="annotation-popover__hint">{t("popover.hint")}</p>
            <p className="annotation-popover__taxonomy-tips">{t("popover.taxonomyTips")}</p>
            {fieldError ? <p className="annotation-popover__field-error">{fieldError}</p> : null}
            <div className="annotation-popover__fields">
              <label className="annotation-popover__label">
                {t("label.grammaticalFunction")}
                <select
                  value={grammaticalFunction}
                  onChange={(e) => onGrammaticalFunctionChange(e.target.value as Gf | "")}
                >
                  <option value="">{t("popover.optSelect")}</option>
                  {GRAMMATICAL_FUNCTION.map((g) => (
                    <option key={g} value={g}>
                      {enumLabel("enum.grammaticalFunction", g)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="annotation-popover__label">
                {t("label.formCategory")}
                {formSelectDisabled ? (
                  <span className="annotation-popover__muted">{t("popover.formNeedsRole")}</span>
                ) : null}
                <select
                  value={formCategory}
                  disabled={formSelectDisabled}
                  onChange={(e) => {
                    const v = e.target.value as Fc | "";
                    setFormCategory(v);
                    if (v !== "clause") {
                      setClauseSubtype("");
                      setSubordinatorHint("");
                    }
                  }}
                >
                  <option value="">{t("popover.optSelect")}</option>
                  {allowedFormCategories.map((g) => (
                    <option key={g} value={g}>
                      {enumLabel("enum.formCategory", g)}
                    </option>
                  ))}
                </select>
              </label>
              <p className="annotation-popover__clause-guide">{t("popover.hintClauseForm")}</p>
              {showClauseFields ? (
                <>
                  <label className="annotation-popover__label">
                    {t("label.clauseSubtype")}
                    <select value={clauseSubtype} onChange={(e) => setClauseSubtype(e.target.value as Cs | "")}>
                      <option value="">{t("popover.optSelect")}</option>
                      {CLAUSE_SUBTYPE.map((g) => (
                        <option key={g} value={g}>
                          {enumLabel("enum.clauseSubtype", g)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="annotation-popover__label">
                    {t("label.subordinatorHint")}
                    <select value={subordinatorHint} onChange={(e) => setSubordinatorHint(e.target.value as Sh | "")}>
                      <option value="">{t("popover.optSelect")}</option>
                      {SUBORDINATOR_HINT.map((g) => (
                        <option key={g} value={g}>
                          {enumLabel("enum.subordinatorHint", g)}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : null}
              <label className="annotation-popover__label">
                {t("label.parentSpanId")}
                <input
                  type="text"
                  placeholder={t("ph.parentSpanId")}
                  value={parentSpanId}
                  onChange={(e) => setParentSpanId(e.target.value)}
                />
              </label>
            </div>
          </div>
          <div className="annotation-popover__actions">
            <button type="button" className="secondary" onClick={onDismiss}>
              {t("popover.btnDismiss")}
            </button>
            <button type="button" className="btn-primary btn-sm" onClick={onConfirm}>
              {t("popover.btnConfirm")}
            </button>
          </div>
        </div>
      </>
    );
  }
);
