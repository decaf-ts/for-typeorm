import { column } from "@decaf-ts/core";
import { Model, ModelArg } from "@decaf-ts/decorator-validation";
import { OperationKeys, timestamp } from "@decaf-ts/db-decorators";

export class TypeORMBaseModel extends Model {
  @column("created_on")
  @timestamp([OperationKeys.CREATE])
  createdOn!: Date;

  @column("updated_on")
  @timestamp()
  updatedOn!: Date;

  constructor(arg?: ModelArg<TypeORMBaseModel>) {
    super(arg);
  }
}
