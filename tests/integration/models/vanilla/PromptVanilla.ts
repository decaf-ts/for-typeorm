import {
  maxlength,
  minlength,
  model,
  type ModelArg,
  required,
  description,
  Model,
} from "@decaf-ts/decorator-validation";
import { PromptBlockVanilla } from "./PromptBlockVanilla";
import {
  Cascade,
  column,
  manyToMany,
  manyToOne,
  oneToOne,
  pk,
  table,
  unique,
  uses,
} from "@decaf-ts/core";
import { TypeORMFlavour } from "../../../src";
import { AIFeature } from "./AIFeature";
import { TypeORMBaseModel } from "../baseModel";
import { Entity, PrimaryGeneratedColumn } from "typeorm";

/**
 * @description Structured prompt entity composed of typed blocks and metrics
 * @summary Represents a complete prompt specification including role, task, optional persona and planning, contextual and formatting blocks, examples, and attached evaluation metrics.
 * @param {ModelArg<PromptVanilla>=} arg Optional initialization argument
 * @class PromptVanilla
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
@Entity()
export class PromptVanilla extends TypeORMBaseModel {
  /**
   * @description Surrogate primary key for the prompt
   */
  @PrimaryGeneratedColumn()
  id!: number;

  @column()
  @unique()
  @maxlength(50)
  reference!: string;
  /**
   * @description Feature(s) capability that this prompt is intended to drive
   */
  @manyToOne(
    () => AIFeature,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    true
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
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  role!: PromptBlockVanilla;

  /**
   * @description Optional persona block influencing tone and behavior
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  persona?: PromptBlockVanilla;

  /**
   * @description Task block describing the required action
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  task!: PromptBlockVanilla;

  /**
   * @description Optional planning strategy block
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  planning?: PromptBlockVanilla;

  /**
   * @description Optional persistence rules block
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  persistence?: PromptBlockVanilla;

  /**
   * @description Acceptance criteria or requirements block
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  requirements?: PromptBlockVanilla;

  /**
   * @description Main content block for the prompt
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  content!: PromptBlockVanilla;

  /**
   * @description Optional external context block
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  context?: PromptBlockVanilla;

  /**
   * @description Optional tools or capabilities block
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  tools?: PromptBlockVanilla;

  /**
   * @description Optional output format instructions
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  format?: PromptBlockVanilla;

  /**
   * @description Example blocks demonstrating expected outputs
   */
  @manyToMany(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  examples?: PromptBlockVanilla[];

  /**
   * @description Optional footnote or additional notes block
   */
  @oneToOne(
    () => PromptBlockVanilla,
    {
      update: Cascade.CASCADE,
      delete: Cascade.NONE,
    },
    true
  )
  footnote?: PromptBlockVanilla;

  constructor(arg?: ModelArg<PromptVanilla>) {
    super(arg);
  }
}
