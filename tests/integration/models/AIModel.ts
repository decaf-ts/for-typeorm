import {
  min,
  model,
  type ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { Cascade, column, manyToMany, pk, table, uses } from "@decaf-ts/core";
import { AIFeature } from "./AIFeature";
import { TypeORMActiveModel } from "./TypeORMActiveModel";
import { TypeORMFlavour } from "../../../src";

/**
 * @description AI model representation with capabilities and features
 * @summary Represents an AI model with its unique identifier, context window size, and supported features
 * @class AIModel
 */
@uses(TypeORMFlavour)
@table("ai_models")
@model()
export class AIModel extends TypeORMActiveModel {
  /**
   * @description Unique identifier for the AI model
   * @summary The model's unique identifier string
   */
  @pk({ type: "String", generated: false })
  name!: string;

  /**
   * @description Maximum context window size in tokens
   * @summary The number of tokens the model can process in a single context window
   */
  @column("context_window")
  @required()
  @min(1)
  contextWindow!: number;

  /**
   * @description List of features supported by this AI model
   * @summary Collection of AI features that this model supports
   */
  @manyToMany(
    () => AIFeature,
    {
      update: Cascade.NONE,
      delete: Cascade.NONE,
    },
    true
  )
  @required()
  features!: AIFeature[];

  @column("price_subscription")
  @required()
  priceSubscription!: number;

  @column("price_per_token_input")
  @required()
  pricePerTokenInput!: number;

  @column("price_per_token_output")
  @required()
  pricePerTokenOutput!: number;
  //
  // @manyToOne(() => AIVendor)
  // vendor!: AIVendor;

  constructor(arg?: ModelArg<AIModel>) {
    super(arg);
  }
}
