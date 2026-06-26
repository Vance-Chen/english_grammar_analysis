import { useEffect, useState } from "react";
import type { StreamEvent } from "../lib/schema";
import { useI18n } from "../i18n";

export type EvaluationPayload = Extract<StreamEvent, { type: "evaluation" }>;

export function ReviewPanel({
  evaluation,
  translation,
  streamLog,
}: {
  evaluation: EvaluationPayload | null;
  translation: string;
  streamLog: string;
}) {
  const { t } = useI18n();
  const [tab, setTab] = useState<"eval" | "trans" | "debug">("eval");

  useEffect(() => {
    if (evaluation) setTab("eval");
  }, [evaluation]);

  return (
    <div className="review-panel">
      <div className="review-panel__tabs" role="tablist">
        <button
          type="button"
          className={`review-panel__tab ${tab === "eval" ? "is-active" : ""}`}
          role="tab"
          aria-selected={tab === "eval"}
          onClick={() => setTab("eval")}
        >
          {t("review.tabEval")}
        </button>
        <button
          type="button"
          className={`review-panel__tab ${tab === "trans" ? "is-active" : ""}`}
          role="tab"
          aria-selected={tab === "trans"}
          onClick={() => setTab("trans")}
        >
          {t("review.tabTrans")}
        </button>
        <button
          type="button"
          className={`review-panel__tab ${tab === "debug" ? "is-active" : ""}`}
          role="tab"
          aria-selected={tab === "debug"}
          onClick={() => setTab("debug")}
        >
          {t("review.tabDebug")}
        </button>
      </div>
      <div className="review-panel__body">
        {tab === "eval" && (
          <div className="review-eval">
            {!evaluation ? (
              <p className="review-empty">{t("review.emptyEval")}</p>
            ) : (
              <>
                <div className="review-score-card">
                  <span className="review-score-card__label">{t("review.score")}</span>
                  <span className="review-score-card__value">{evaluation.overallScore}</span>
                </div>
                {evaluation.summary ? (
                  <section className="review-block">
                    <h3 className="review-block__title">{t("review.summary")}</h3>
                    <p className="review-block__text">{evaluation.summary}</p>
                  </section>
                ) : null}
                <section className="review-block">
                  <h3 className="review-block__title">{t("review.dimension")}</h3>
                  <ul className="review-dim-list">
                    {evaluation.dimensions.map((d) => (
                      <li key={d.name} className="review-dim-list__item">
                        <div className="review-dim-list__head">
                          <span className="review-dim-list__name">{d.name}</span>
                          <span className="review-dim-list__score">{d.score}</span>
                        </div>
                        <div className="review-dim-list__bar" aria-hidden>
                          <span className="review-dim-list__bar-fill" style={{ width: `${d.score}%` }} />
                        </div>
                        {d.comment ? <p className="review-dim-list__comment">{d.comment}</p> : null}
                      </li>
                    ))}
                  </ul>
                </section>
                {evaluation.differences && evaluation.differences.length > 0 ? (
                  <section className="review-block">
                    <h3 className="review-block__title">{t("review.diff")}</h3>
                    <ul className="review-diff-list">
                      {evaluation.differences.map((diff, i) => (
                        <li key={i} className="review-diff-list__item">
                          <p className="review-diff-list__issue">{diff.issue}</p>
                          {diff.suggestion ? (
                            <p className="review-diff-list__suggestion">{diff.suggestion}</p>
                          ) : null}
                          {diff.spanId ? (
                            <p className="review-diff-list__meta">span: {diff.spanId}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}
          </div>
        )}
        {tab === "trans" && (
          <div className="review-trans prose-block">
            {translation || t("out.translationWait")}
          </div>
        )}
        {tab === "debug" && (
          <pre className="review-debug">{streamLog || t("out.sseEmpty")}</pre>
        )}
      </div>
    </div>
  );
}
