import {
  model,
  type ModelArg,
  required,
  type,
} from "@decaf-ts/decorator-validation";
import {
  Cascade,
  column,
  manyToMany,
  oneToOne,
  pk,
  table,
  uses,
} from "@decaf-ts/core";
import { TypeORMBaseModel } from "../baseModel";
import { TypeORMFlavour } from "../../../src";
import { PromptBlockType } from "./contants";
import { AIFeature } from "./AIFeature";
import { AIVendor } from "./AIVendor";
import { AIModel } from "./AIModel";

/**
 * @description Atomic building block of a prompt
 * @summary Encapsulates a typed section of a prompt (role, task, context, etc.), its content, and related AI feature/vendor/model selections.
 * @param {ModelArg<PromptBlockVanilla>=} arg Optional initialization argument
 * @class PromptBlockVanilla
 * @example
 * const role = new PromptBlock();
 * // role.type = PromptBlockType.ROLE; role.content = "You are a helpful assistant";
 * @mermaid
 * sequenceDiagram
 *   participant PB as PromptBlock
 *   PB-->>PB: set type/content
 */
@uses(TypeORMFlavour)
@table("prompt_blocks")
@model()
export class PromptBlockVanilla extends TypeORMBaseModel {
  /**
   * @description Surrogate primary key for the prompt block
   */
  @pk({ type: "Number" })
  id!: number;
  //
  // /**
  //  * @description The specific kind of block (e.g., role, task, context)
  //  */
  // @column()
  // @required()
  // @type(String.name)
  // classification!: PromptBlockType;

  /**
   * @description Related AI feature(s) that this block is associated with
   */
  @manyToMany(
    () => AIFeature,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    false
  )
  @required()
  features!: AIFeature[];

  /**
   * @description Textual content of the block
   */
  @column()
  @required()
  content!: string;

  constructor(arg?: ModelArg<PromptBlockVanilla>) {
    super(arg);
  }
}
