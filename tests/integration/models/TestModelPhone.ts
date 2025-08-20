import { Cascade, column, manyToOne, pk, table, uses } from "@decaf-ts/core";
import { TypeORMFlavour } from "../../../src";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "../baseModel";
import { TestUserModel } from "./TestUserModel";

@uses(TypeORMFlavour)
@table("tst_phone")
@model()
export class TestPhoneModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_area_code")
  @required()
  areaCode!: string;

  @column("tst_phone_number")
  @required()
  phoneNumber!: string;

  @manyToOne(() => TestUserModel, {
    update: Cascade.CASCADE,
    delete: Cascade.CASCADE,
  })
  user!: TestUserModel;

  constructor(m?: ModelArg<TestPhoneModel>) {
    super(m);
  }
}

export function testPhone(p: TestPhoneModel) {
  expect(p).toBeInstanceOf(TestPhoneModel);
  expect(p.id).toBeDefined();
  expect(p.createdOn).toBeDefined();
  expect(p.updatedOn).toBeDefined();
}
