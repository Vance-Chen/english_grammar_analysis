"""与前端 schema 对齐的 Pydantic 模型（taxonomy 1.0.3）。"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

TAXONOMY_VERSION = "1.0.3"
INDEX_ENCODING = "utf-16"

SentenceClass = Literal[
    "declarative",
    "yes_no_question",
    "wh_question",
    "alternative_question",
    "tag_question",
    "imperative",
    "exclamative",
]
StructureType = Literal["simple", "compound", "complex", "compound_complex"]
SpecialPattern = Literal[
    "none",
    "full_inversion",
    "partial_inversion",
    "cleft_it",
    "ellipsis",
    "discontinuous_modifier",
    "other",
]
GrammaticalFunction = Literal[
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
    "unknown",
]
ClauseSubtype = Literal[
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
]
FormCategory = Literal[
    "infinitive_phrase",
    "gerund_phrase",
    "participle_phrase",
    "prep_phrase",
    "clause",
    "np",
    "adj_phrase",
    "coordination",
    "vp",
    "other",
    "unknown",
]
SubordinatorHint = Literal["zero", "that", "wh", "if_whether", "prep_which", "other"]

VerbTense = Literal[
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
]
VerbVoice = Literal["unspecified", "active", "passive", "other"]


class SpanAnnotation(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    id: str = Field(min_length=1, max_length=64)
    start: int = Field(ge=0)
    end: int = Field(ge=0)
    grammatical_function: GrammaticalFunction = Field(alias="grammaticalFunction")
    form_category: FormCategory = Field(alias="formCategory")
    clause_subtype: ClauseSubtype | None = Field(default=None, alias="clauseSubtype")
    subordinator_hint: SubordinatorHint | None = Field(default=None, alias="subordinatorHint")
    parent_span_id: str | None = Field(default=None, min_length=1, max_length=64, alias="parentSpanId")
    notes: str | None = Field(default=None, max_length=2000)


class SentencePatterns(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    sentence_class: SentenceClass = Field(alias="sentenceClass")
    structure_type: StructureType = Field(alias="structureType")
    special_patterns: list[SpecialPattern] = Field(default_factory=list, alias="specialPatterns")
    sentence_pattern_notes: str | None = Field(default=None, max_length=2000, alias="sentencePatternNotes")
    verb_tense: VerbTense = Field(default="unspecified", alias="verbTense")
    verb_voice: VerbVoice = Field(default="unspecified", alias="verbVoice")


class BundleMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    client_version: str | None = Field(default=None, alias="clientVersion")
    session_id: str | None = Field(default=None, alias="sessionId")


class AnnotationBundle(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    taxonomy_version: Literal["1.0.3"] = Field(alias="taxonomyVersion")
    sentence_id: str | None = Field(default=None, alias="sentenceId")
    text: str = Field(min_length=1, max_length=4000)
    normalized_text: str | None = Field(default=None, alias="normalizedText")
    index_encoding: Literal["utf-16"] = Field(alias="indexEncoding")
    sentence_patterns: SentencePatterns = Field(alias="sentencePatterns")
    spans: list[SpanAnnotation]
    metadata: BundleMetadata | None = None


class TtsJobCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    sentence_hash: str = Field(alias="sentenceHash")
    text: str
    voice: str | None = None


class VocabularyCreate(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    lemma: str
    context_sentence_id: str = Field(alias="contextSentenceId")
    span_start: int | None = Field(default=None, alias="spanStart")
    span_end: int | None = Field(default=None, alias="spanEnd")


def bundle_to_jsonable(bundle: AnnotationBundle) -> dict[str, Any]:
    """供 LLM 请求使用（camelCase）。"""
    return bundle.model_dump(mode="json", by_alias=True)
