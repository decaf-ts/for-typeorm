import "../../src/type-orm";
import {
  Model,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import typeorm, { Entity } from "typeorm";
import { pk, table } from "@decaf-ts/core";

const EntityMock = jest.spyOn(typeorm, "Entity");

@table("orm_person")
@model()
class ORMPerson extends Model {
  @pk()
  id!: number;

  @required()
  name!: number;

  constructor(arg?: ModelArg<ORMPerson>) {
    super(arg);
  }
}

describe("TypeOrm Decoration", () => {
  it("calls type-orm decorators via extension", () => {
    expect(ORMPerson).toBeDefined();
    expect(EntityMock).toHaveBeenCalled();
  });
});
