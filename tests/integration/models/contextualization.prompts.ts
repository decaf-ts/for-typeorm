import { AIFeatures, AIVendors, PromptBlockType } from "./contants";
import { PromptBlock } from "./PromptBlock";
import { Prompt } from "./Prompt";

export const contextualizationRolePrompts: PromptBlock[] = [
  {
    block: `You are a careful editor. Rewrite the CHUNK using the provided CONTEXT blocks and optional GLOSSARY to make it fully self-contained and clear.`,
    vendors: [AIVendors.OPEN_AI],
    models: ["gpt-4.1"],
  },
].map(({ block, vendors, models }) => {
  return new PromptBlock({
    classification: PromptBlockType.ROLE,
    features: [AIFeatures.CONTEXTUALIZATION],
    content: block,
    vendors: vendors,
    models: models,
  });
});

export const contextualizationTaskPrompts = [
  {
    block: `1) Contextualize the CHUNK by resolving references using CONTEXT.
2) Replace pronouns with their specific named referents when deterministically available.
   - Scope (choose one): {PRONOUN_SCOPE=all | third-person-only}. Default: all.
   - Preserve meaning, tense, and tone. Do not invent facts.
   - If a pronoun’s referent is not clear from CONTEXT, leave the pronoun as-is and add a footnote noting the ambiguity.
3) Expand acronyms at their first occurrence in the rewritten text using GLOSSARY.
   - Format: {ACRONYM_STYLE="ABC (definition)"} (default) or {"Full Term (ABC)"} if a full term is available.
   - Only expand once per acronym; leave subsequent mentions unchanged.
   - If an acronym isn’t in GLOSSARY, do not guess; leave it as-is.`,
    vendors: [AIVendors.OPEN_AI],
    models: ["gpt-4.1"],
  },
].map(({ block, vendors, models }) => {
  return new PromptBlock({
    classification: PromptBlockType.TASK,
    features: [AIFeatures.CONTEXTUALIZATION],
    content: block,
    vendor: vendors,
    models: models,
  });
});

export const contextualizationRequirementsPrompts = [
  {
    block: `- Use CONTEXT to resolve references (people, teams, products, artifacts, dates, places, “it/this/that/they/these/those”).
- Prefer full names on first mention; later mentions may use the shortest unambiguous form (e.g., surname or team).
- Keep quotes and technical terms intact; do not paraphrase code or error messages.
- Preserve numbering, bulleting, and formatting where possible.
- Do not add, remove, or reorder content beyond what’s needed for clarity and the required replacements/expansions.`,
    vendors: [AIVendors.OPEN_AI],
    models: ["gpt-4.1"],
  },
].map(({ block, vendors, models }) => {
  return new PromptBlock({
    classification: PromptBlockType.REQUIREMENTS,
    features: [AIFeatures.CONTEXTUALIZATION],
    content: block,
    vendors: vendors,
    models: models,
  });
});

export const contextualizationContentPrompts = [
  {
    block: `\n- CHUNK: <<<chunk starts>>>
{0}
<<<chunk ends>>>`,
    vendors: [AIVendors.OPEN_AI],
    models: ["gpt-4.1"],
  },
].map(({ block, vendors, models }) => {
  return new PromptBlock({
    classification: PromptBlockType.CONTENT,
    features: [AIFeatures.SUMMARIZATION],
    content: block,
    vendors: vendors,
    models: models,
  });
});

export const contextualizationContextPrompts = [
  {
    block: `(one or more blocks; earlier blocks are higher priority):
  {0}
  - GLOSSARY 
  {1}`,
    vendors: [AIVendors.OPEN_AI],
    models: ["gpt-4.1"],
  },
].map(({ block, vendors, models }) => {
  return new PromptBlock({
    classification: PromptBlockType.CONTEXT,
    features: [AIFeatures.CONTEXTUALIZATION],
    content: block,
    vendors: vendors,
    models: models,
  });
});

export const contextualizationFormatPrompts = [
  {
    block: `Return a single JSON object with:
{
  "text": "<the fully rewritten, contextualized text>",
  "first_occurrence_expansions": [
    {"acronym": "SRE", "expanded_to": "SRE (Site Reliability Engineering)"},
    {"acronym": "ASAP", "expanded_to": "ASAP (as soon as possible)"}
  ],
  "replacements_log": [
    {"from": "he", "to": "Alex Silva", "evidence": "[C1] org chart, sentence 2"},
    {"from": "her", "to": "Maria Pereira", "evidence": "[C1] meeting attendees"}
  ],
  "ambiguous": [
    {"pronoun": "it", "note": "Unclear whether 'it' refers to the API or the database", "spans": [42, 44]}
  ]
}
Only output valid JSON—no extra commentary.`,
    vendors: [AIVendors.OPEN_AI],
    models: ["gpt-4.1"],
  },
].map(({ block, vendors, models }) => {
  return new PromptBlock({
    classification: PromptBlockType.FORMAT,
    features: [AIFeatures.CONTEXTUALIZATION],
    content: block,
    vendor: vendors,
    model: models,
  });
});

export const ContextualizationPrompts = [
  {
    role: contextualizationRolePrompts[0],
    persona: undefined,
    task: contextualizationTaskPrompts[0],
    planning: undefined,
    persistence: undefined,
    requirements: contextualizationRequirementsPrompts[0],
    content: contextualizationContentPrompts[0],
    context: contextualizationContextPrompts[0],
    tools: undefined,
    format: contextualizationFormatPrompts[0],
    examples: undefined,
    footnote: undefined,

    description: "General contextualization Prompt",
    reference: AIFeatures.CONTEXTUALIZATION,
  },
].map(
  (p) =>
    new Prompt(
      Object.assign(p, {
        feature: AIFeatures.CONTEXTUALIZATION,
      })
    )
);
