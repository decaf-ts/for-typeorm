import { AIFeatures as AIF } from "./contants";
import { AIFeature } from "./AIFeature";

export const SupportedAIFeatures = [
  {
    name: AIF.SUMMARIZATION,
    description:
      "Shorten one or more documents into a concise version that keeps the main points and meaning",
  },
  {
    name: AIF.CONTEXTUALIZATION,
    description:
      "Add useful background (e.g., document, section, surrounding text) so each chunk is better understood and more findable in search.",
  },
  {
    name: AIF.KEYWORDS,
    description:
      "Pull out the most important words or short phrases that capture what the text is about, for tagging or search.",
  },
  {
    name: AIF.RERANKING,
    description:
      "Reorder an initial set of retrieved passages by deeper relevance signals (semantic match, context, rules) so the best results rise to the top",
  },
  {
    name: AIF.TEXT_TO_SPEECH,
    description:
      "Turn written text into natural-sounding synthetic speech, using neural models that learn voices and prosody. ",
  },
  {
    name: AIF.SPEECH_TO_TEXT,
    description:
      "Convert spoken audio into written words (transcription), often with timestamps and confidence scores.",
  },
  {
    name: AIF.IMAGE_TO_TEXT,
    description:
      "Read and describe what’s in an image: extract printed text (OCR) and/or generate a caption in natural language.",
  },
  {
    name: AIF.TEXT_TO_VIDEO,
    description:
      "Generate short video clips (with motion and possibly audio) from a text prompt describing the scene or action",
  },
  {
    name: AIF.VISION_TO_TEXT,
    description:
      "Answer questions or give descriptions about what’s shown in images or video frames by combining vision and language understanding.",
  },
  {
    name: AIF.OBJECT_RECOGNITION,
    description:
      "Detect and label specific objects in images or video and report where they are (boxes or masks).",
  },
  {
    name: AIF.REASONING,
    description:
      "Work through problems step-by-step (internally or out loud), checking logic before giving a final answer.",
  },
  {
    name: AIF.QUESTION_ANSWERING,
    description:
      "Find and return answers to user questions by reading or retrieving relevant information from data sources.",
  },
  {
    name: AIF.TRANSLATION,
    description:
      "Convert text from one language into another while preserving meaning and style, using neural machine translation.",
  },
  {
    name: AIF.PLANNING,
    description:
      "Create an ordered set of steps or strategy to get from a starting situation to a goal under given constraints.",
  },
  {
    name: AIF.CHAT,
    description:
      "Hold a multi-turn conversation that understands context and responds naturally, beyond rigid scripted bots.",
  },
  {
    name: AIF.RESEARCH,
    description:
      "Quickly gather, screen, and summarize information from many sources to answer a focused question or explore a topic.",
  },
  {
    name: AIF.DEEP_RESEARCH,
    description:
      "Run a multi-step, in-depth investigation: plan queries, collect and analyze sources, compare evidence, and produce a detailed report.",
  },
].map((m) => new AIFeature(m));
