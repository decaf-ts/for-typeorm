export enum AIVendors {
  GOOGLE = "google",
  OPEN_AI = "openai",
  ANTHROPIC = "anthropic",
  PERPLEXITY = "perplexity",
  MIDJOURNEY = "midjourney",
  RUNWAY = "runway",
  OLLAMA = "ollama",
}

export enum AIFeatures {
  SUMMARIZATION = "summarization",
  CONTEXTUALIZATION = "contextualization",
  KEYWORDS = "keywords",
  RERANKING = "reraking",
  TEXT_TO_SPEECH = "text-to-speech",
  SPEECH_TO_TEXT = "speech-to-text",
  IMAGE_TO_TEXT = "image-to-text",
  TEXT_TO_VIDEO = "text-to-video",
  VISION_TO_TEXT = "vision-to-text",
  OBJECT_RECOGNITION = "object-recognition",
  REASONING = "reasoning",
  QUESTION_ANSWERING = "question-answering",
  CHAT = "chat",
  TRANSLATION = "translation",
  PLANNING = "planning",
  RESEARCH = "research",
  DEEP_RESEARCH = "deep-research",
}

export enum PromptBlockType {
  /** The role or instruction perspective (e.g., "You are a helpful assistant") */
  ROLE = "role",
  /** A persona definition that influences tone and behavior */
  PERSONA = "persona",
  /** The task description detailing what must be done */
  TASK = "task",
  /** Tools or capabilities to be used or referenced */
  TOOL = "tool",
  /** Concrete examples illustrating expected behavior or format */
  EXAMPLE = "example",
  /** Persistence rules such as memory or state handling */
  PERSISTENCE = "persistence",
  /** Explicit requirements or acceptance criteria */
  REQUIREMENTS = "requirements",
  /** Planning steps or strategies to reach the goal */
  PLANNING = "planning",
  /** Main content or payload for the prompt */
  CONTENT = "content",
  /** External context or background information */
  CONTEXT = "context",
  /** Output formatting instructions */
  FORMAT = "format",
  /** Footnotes or additional observations */
  FOOTNOTE = "footnote",
}
