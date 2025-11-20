import { model, type ModelArg, required } from "@decaf-ts/decorator-validation";
import { Cascade, column, manyToMany, pk, table } from "@decaf-ts/core";
import { TypeORMBaseModel } from "../baseModel";
import { TypeORMFlavour } from "../../../src";
import { AIFeature } from "./AIFeature";
import { AIVendor } from "./AIVendor";
import { AIModel } from "./AIModel";
import { uses } from "@decaf-ts/decoration";

/**
 * @description Atomic building block of a prompt
 * @summary Encapsulates a typed section of a prompt (role, task, context, etc.), its content, and related AI feature/vendor/model selections.
 * @param {ModelArg<PromptBlock>=} arg Optional initialization argument
 * @class PromptBlock
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
export class PromptBlock extends TypeORMBaseModel {
  /**
   * @description Surrogate primary key for the prompt block
   */
  @pk({ type: "Number" })
  id!: number;

  /**
   * @description The specific kind of block (e.g., role, task, context)
   */
  @column()
  @required()
  classification!: string;

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
   * @description Textual content of the block
   */
  @column()
  @required()
  content!: string;

  constructor(arg?: ModelArg<PromptBlock>) {
    super(arg);
  }
}
