import { BaseModel, column } from "@decaf-ts/core";
import { ModelArg } from "@decaf-ts/decorator-validation";

export class PGBaseModel extends BaseModel {
  @column("created_on")
  createdOn!: Date;

  @column("updated_on")
  updatedOn!: Date;

  constructor(arg?: ModelArg<PGBaseModel>) {
    super(arg);
  }
}
