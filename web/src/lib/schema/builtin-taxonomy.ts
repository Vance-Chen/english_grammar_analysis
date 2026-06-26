/** 与 grammar_taxonomy.yaml 同步；修改时请同时更新 YAML */
export const TAXONOMY_VERSION = "1.0.3";

export const INDEX_ENCODING = "utf-16" as const;

export const SENTENCE_CLASS = [
  "declarative",
  "yes_no_question",
  "wh_question",
  "alternative_question",
  "tag_question",
  "imperative",
  "exclamative",
] as const;

export const STRUCTURE_TYPE = [
  "simple",
  "compound",
  "complex",
  "compound_complex",
] as const;

export const SPECIAL_PATTERN = [
  "none",
  "full_inversion",
  "partial_inversion",
  "cleft_it",
  "ellipsis",
  "discontinuous_modifier",
  "other",
] as const;

export const GRAMMATICAL_FUNCTION = [
  "S",
  "V",
  "O",
  "IO",
  "DO",
  "P",
  "OC",
  "Adv",
  "Adj_mod",
  "Appos",
  "Parenthetical",
  "Conj",
  "Subordinator",
  "other",
  /** 用户不确定句法功能；提交后由模型侧重讲解 */
  "unknown",
] as const;

export const CLAUSE_SUBTYPE = [
  "nominal",
  "relative",
  "adverbial_time",
  "adverbial_reason",
  "adverbial_condition",
  "adverbial_contrast",
  "adverbial_place",
  "adverbial_result",
  "adverbial_purpose",
  "adverbial_manner",
  "adverbial_other",
] as const;

export const FORM_CATEGORY = [
  "infinitive_phrase",
  "gerund_phrase",
  "participle_phrase",
  "prep_phrase",
  "clause",
  "np",
  "adj_phrase",
  "coordination",
  /** 谓语动词 / 限定动词短语（与 grammaticalFunction=V 搭配） */
  "vp",
  "other",
  /** 用户不确定结构形式；提交后由模型侧重讲解 */
  "unknown",
] as const;

export const SUBORDINATOR_HINT = [
  "zero",
  "that",
  "wh",
  "if_whether",
  "prep_which",
  "other",
] as const;

/** 全句主要谓语的时态（教学/命题用）；与 span 内 V 标注互补 */
export const VERB_TENSE = [
  "unspecified",
  "present_simple",
  "past_simple",
  "future_simple",
  "present_continuous",
  "past_continuous",
  "future_continuous",
  "present_perfect",
  "past_perfect",
  "future_perfect",
  "present_perfect_continuous",
  "past_perfect_continuous",
  "other",
] as const;

/** 全句主要谓语的语态 */
export const VERB_VOICE = ["unspecified", "active", "passive", "other"] as const;
