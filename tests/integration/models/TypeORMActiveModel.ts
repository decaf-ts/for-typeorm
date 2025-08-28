import { TypeORMBaseModel } from "../baseModel";
import { ModelArg, required } from "@decaf-ts/decorator-validation";
import { column } from "@decaf-ts/core";

export class TypeORMActiveModel extends TypeORMBaseModel {

  @column("tst_active")
  @required()
  active: boolean = true;

  constructor(arg: ModelArg<TypeORMBaseModel>) {
    super(arg);
  }
}