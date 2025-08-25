import {
  Cascade,
  column,
  oneToOne,
  pk,
  table,
  uses,
  index,
  oneToMany,
} from "@decaf-ts/core";
import { TypeORMFlavour } from "../../../src";
import {
  model,
  ModelArg,
  required,
  email,
  min,
} from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "../baseModel";
import { testAddress, TestAddressModel } from "../models";
import { testPhone, TestPhoneModel } from "./TestModelPhone";

@uses(TypeORMFlavour)
@table("tst_user")
@model()
export class TestUserModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  @required()
  @index()
  name!: string;

  @column("tst_email")
  @required()
  @email()
  @index()
  email!: string;

  @column("tst_age")
  @required()
  @min(18)
  @index()
  age!: number;

  @oneToOne(() => TestAddressModel, {
    update: Cascade.CASCADE,
    delete: Cascade.CASCADE,
  })
  address!: TestAddressModel;

  @oneToMany(
    () => TestPhoneModel,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  phones!: TestPhoneModel[];

  constructor(m?: ModelArg<TestUserModel>) {
    super(m);
  }
}

export function testUser(user: TestUserModel) {
  expect(user).toBeDefined();
  expect(user).toBeInstanceOf(TestUserModel);
  expect(user.id).toBeDefined();
  expect(user.createdOn).toBeDefined();
  expect(user.updatedOn).toBeDefined();

  const { address, phones } = user as TestUserModel;

  testAddress(address as TestAddressModel);

  expect(phones).toBeDefined();
  expect(phones.length).toBeGreaterThan(1);
  phones.forEach((p) => testPhone(p));
}
