import "../../src/type-orm";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { BaseModel, column, pk, table } from "@decaf-ts/core";

//
// @table("orm_phones")
// @model()
// class ORMPhone extends BaseModel {
//   @pk()
//   id!: number;
//
//   @column("orm_number")
//   @required()
//   number!: number;
//
//   constructor(arg?: ModelArg<ORMPhone>) {
//     super(arg);
//   }
// }

@table("orm_persons")
@model()
class ORMPerson extends BaseModel {
  @pk()
  id!: number;

  @column("orm_name")
  @required()
  name!: number;

  constructor(arg?: ModelArg<ORMPerson>) {
    super(arg);
  }
}

describe("TypeOrm Decoration", () => {
  it("calls type-orm decorators via extension", () => {
    expect(ORMPerson).toBeDefined();
  });
});
