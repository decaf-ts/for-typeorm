import {
  model,
  type ModelArg,
  required,
  type,
} from "@decaf-ts/decorator-validation";
import { column, pk, table, uses } from "@decaf-ts/core";
import { TypeORMFlavour } from "../../../src";
import { TypeORMBaseModel } from "../baseModel";
import { AIFeatures } from "./contants";

/**
 * @description AI feature capability representation
 * @summary Represents a specific capability or feature that an AI model can support
 * @class AIFeature
 */
@uses(TypeORMFlavour)
@table("ai_features")
@model()
export class AIFeature extends TypeORMBaseModel {
  /**
   * @description Display name of the feature
   * @summary Human-readable name for the feature
   */
  // @ts-expect-error because
  @pk({ type: "String", generated: false })
  @type(String.name)
  name!: AIFeatures;

  /**
   * @description Detailed explanation of the feature
   * @summary Explains what the feature does and how it can be used
   */
  @column()
  @required()
  description!: string;

  constructor(arg?: ModelArg<AIFeature>) {
    super(arg);
  }
}
