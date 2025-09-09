import {
  maxlength,
  minlength,
  model,
  type ModelArg,
  required,
  description,
} from "@decaf-ts/decorator-validation";
import { PromptBlock } from "./PromptBlock";
import {
  Cascade,
  column,
  index,
  manyToMany,
  manyToOne,
  pk,
  table,
  unique,
  uses,
} from "@decaf-ts/core";
import { TypeORMFlavour } from "../../../src";
import { AIFeature } from "./AIFeature";
import { TypeORMBaseModel } from "../baseModel";
import { AIVendor } from "./AIVendor";
import { AIModel } from "./AIModel";

/**
 * @description Structured prompt entity composed of typed blocks and metrics
 * @summary Represents a complete prompt specification including role, task, optional persona and planning, contextual and formatting blocks, examples, and attached evaluation metrics.
 * @param {ModelArg<Prompt>=} arg Optional initialization argument
 * @class Prompt
 * @example
 * const p = new Prompt();
 * // p.role = new PromptBlock({ type: PromptBlockType.ROLE, content: "You are..." });
 * // p.task = new PromptBlock({ type: PromptBlockType.TASK, content: "Do X" });
 * @mermaid
 * sequenceDiagram
 *   participant P as Prompt
 *   participant PB as PromptBlock
 *   P->>PB: link role/task/etc.
 */
@description(
  "Stores the sorted PromptBlocks in their intended order and the metrics for the prompt"
)
@uses(TypeORMFlavour)
@table("prompts")
@model()
export class Prompt extends TypeORMBaseModel {
  /**
   * @description Surrogate primary key for the prompt
   */
  @pk({ type: "Number" })
  id!: number;

  @index()
  @column()
  @unique()
  @maxlength(50)
  reference!: string;

  /**
   * @description Preferred AI vendor for this block
   */
  @manyToMany(
    () => AIVendor,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    false
  )
  vendors?: AIVendor[];

  /**
   * @description Set of models applicable to this block
   */
  @manyToMany(
    () => AIModel,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    false
  )
  models?: AIModel[];

  /**
   * @description Feature(s) capability that this prompt is intended to drive
   */
  @manyToOne(
    () => AIFeature,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    false
  )
  @required()
  feature!: AIFeature;

  /**
   * @description Human-readable description of the prompt's intent
   */
  @column()
  @required()
  @minlength(20)
  description!: string;

  /**
   * @description Role block defining the instruction perspective
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  role!: PromptBlock;

  /**
   * @description Optional persona block influencing tone and behavior
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  persona?: PromptBlock;

  /**
   * @description Task block describing the required action
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  task!: PromptBlock;

  /**
   * @description Optional planning strategy block
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  planning?: PromptBlock;

  /**
   * @description Optional persistence rules block
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  persistence?: PromptBlock;

  /**
   * @description Acceptance criteria or requirements block
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  requirements?: PromptBlock;

  /**
   * @description Main content block for the prompt
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  content!: PromptBlock;

  /**
   * @description Optional external context block
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  context?: PromptBlock;

  /**
   * @description Optional tools or capabilities block
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  tools?: PromptBlock;

  /**
   * @description Optional output format instructions
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  format?: PromptBlock;

  /**
   * @description Example blocks demonstrating expected outputs
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  examples?: PromptBlock[];

  /**
   * @description Optional footnote or additional notes block
   */
  @manyToOne(
    () => PromptBlock,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  footnote?: PromptBlock;

  constructor(arg?: ModelArg<Prompt>) {
    super(arg);
  }
}
