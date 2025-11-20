import { AIModel } from "./AIModel";
import { model, type } from "@decaf-ts/decorator-validation";
import type { ModelArg } from "@decaf-ts/decorator-validation";
import { Cascade, oneToMany, pk, table } from "@decaf-ts/core";
import { TypeORMActiveModel } from "./TypeORMActiveModel";
import { TypeORMFlavour } from "../../../src";
import { AIVendors } from "./contants";
import { uses } from "@decaf-ts/decoration";

/**
 * @description AI provider entity with available models
 * @summary Represents an AI service provider with its unique identifier and collection of supported AI models
 * @class AIVendor
 */
@uses(TypeORMFlavour)
@table("ai_vendors")
@model()
export class AIVendor extends TypeORMActiveModel {
  /**
   * @description Unique identifier for the AI provider
   * @summary The provider's unique identifier string
   */
  @pk({ type: "String", generated: false })
  @type(String)
  name!: AIVendors;
  /**
   * @description Collection of AI models offered by this provider
   * @summary List of AI models that this provider makes available
   */
  @oneToMany(
    () => AIModel,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  models!: AIModel[];

  constructor(arg?: ModelArg<AIVendor>) {
    super(arg);
  }
}
