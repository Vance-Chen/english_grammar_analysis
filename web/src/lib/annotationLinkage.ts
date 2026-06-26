import { FORM_CATEGORY, GRAMMATICAL_FUNCTION } from "./schema";

type Gf = (typeof GRAMMATICAL_FUNCTION)[number];
type Fc = (typeof FORM_CATEGORY)[number];

const UNKNOWN_FC: Fc = "unknown";

/**
 * 句子成分（句法功能）与结构形式的合理组合；用于下拉联动与切换成分时的自动清理。
 * 「unknown」在任一成分下均可选，表示用户不确定结构形式。
 */
const ALLOWED_FORM_BY_GF = {
  S: ["np", "clause", "gerund_phrase", "infinitive_phrase", "coordination", "other"] as const satisfies readonly Fc[],
  V: ["vp", "coordination", "other"] as const satisfies readonly Fc[],
  O: ["np", "clause", "infinitive_phrase", "gerund_phrase", "prep_phrase", "coordination", "other"] as const satisfies readonly Fc[],
  IO: ["np", "clause", "infinitive_phrase", "gerund_phrase", "prep_phrase", "coordination", "other"] as const satisfies readonly Fc[],
  DO: ["np", "clause", "infinitive_phrase", "gerund_phrase", "prep_phrase", "coordination", "other"] as const satisfies readonly Fc[],
  P: ["np", "adj_phrase", "clause", "prep_phrase", "infinitive_phrase", "gerund_phrase", "coordination", "other"] as const satisfies readonly Fc[],
  OC: ["np", "adj_phrase", "infinitive_phrase", "participle_phrase", "prep_phrase", "clause", "other"] as const satisfies readonly Fc[],
  Adv: [
    "prep_phrase",
    "clause",
    "participle_phrase",
    "infinitive_phrase",
    "gerund_phrase",
    "np",
    "adj_phrase",
    "other",
  ] as const satisfies readonly Fc[],
  Adj_mod: [
    "adj_phrase",
    "participle_phrase",
    "prep_phrase",
    "clause",
    "infinitive_phrase",
    "gerund_phrase",
    "coordination",
    "other",
  ] as const satisfies readonly Fc[],
  Appos: ["np", "clause", "other"] as const satisfies readonly Fc[],
  Parenthetical: ["np", "clause", "prep_phrase", "gerund_phrase", "infinitive_phrase", "other"] as const satisfies readonly Fc[],
  Conj: ["coordination", "other"] as const satisfies readonly Fc[],
  Subordinator: ["clause", "other"] as const satisfies readonly Fc[],
  other: [...FORM_CATEGORY] as const satisfies readonly Fc[],
  unknown: [...FORM_CATEGORY] as const satisfies readonly Fc[],
} satisfies Record<Gf, readonly Fc[]>;

export function allowedFormCategoriesForGrammaticalFunction(gf: Gf | ""): Fc[] {
  if (gf === "") return [...FORM_CATEGORY];
  const base = [...ALLOWED_FORM_BY_GF[gf]];
  if (!base.includes(UNKNOWN_FC)) base.push(UNKNOWN_FC);
  return base;
}

export function isFormCategoryCompatibleWithGrammaticalFunction(gf: Gf | "", fc: Fc | ""): boolean {
  if (fc === "") return true;
  if (gf === "") return true;
  if (fc === UNKNOWN_FC) return true;
  return (ALLOWED_FORM_BY_GF[gf] as readonly string[]).includes(fc);
}
