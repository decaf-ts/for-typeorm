import {
  model,
  ModelArg,
  pattern,
  required,
} from "@decaf-ts/decorator-validation";
import { Cascade, column, index, oneToOne, pk, table } from "@decaf-ts/core";
import { uses, prop } from "@decaf-ts/decoration";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMFlavour } from "../../src";

@uses(TypeORMFlavour)
@table("tst_country")
@model()
export class TestCountryModel extends TypeORMBaseModel {
  @column("tst_id")
  @pk({ type: "Number" })
  id!: number;

  @index()
  @column("tst_name")
  @required()
  name!: string;

  @column("tst_country_code")
  @required()
  countryCode!: string;

  @column("tst_locale")
  @required()
  @pattern(/[a-z]{2}(?:_[A-Z]{2})?/g)
  locale!: string;

  constructor(m?: ModelArg<TestCountryModel>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_address")
@model()
export class TestAddressModel extends TypeORMBaseModel {
  @column("tst_id")
  @pk({ type: "Number" })
  id!: number;

  @column("tst_street")
  @required()
  street!: string;

  @column("tst_door_number")
  @required()
  doorNumber!: string;

  @column("tst_apartment_number")
  @prop()
  apartmentNumber?: string;

  @column("tst_area_code")
  @required()
  areaCode!: string;

  @index()
  @column("tst_city")
  @required()
  city!: string;

  @oneToOne(
    TestCountryModel,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  @required()
  country!: TestCountryModel;

  constructor(m?: ModelArg<TestAddressModel>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_dummy_country")
@model()
export class TestDummyCountry extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @index(["countryCode"])
  @column("tst_name")
  @required()
  name!: string;

  @column("tst_country_code")
  @required()
  countryCode!: string;

  constructor(m?: ModelArg<TestDummyCountry>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_no_populate_once")
@model()
export class NoPopulateOnceModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @required()
  @oneToOne(
    TestDummyCountry,
    { update: Cascade.CASCADE, delete: Cascade.CASCADE },
    false
  )
  country!: TestDummyCountry;

  constructor(m?: ModelArg<NoPopulateOnceModel>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_dummy_phone")
@model()
export class TestDummyPhone extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;
  @index(["areaCode", "phoneNumber"])
  @column("tst_area_code")
  @required()
  areaCode!: string;
  @column("tst_phone_number")
  @required()
  phoneNumber!: string;

  constructor(m?: ModelArg<TestDummyPhone>) {
    super(m);
  }
}
// @uses(TypeORMFlavour)
// @table("tst_no_populate_many")
// @model()
// export class NoPopulateManyModel extends TypeORMBaseModel {
//   @pk({ type: "Number" })
//   id!: number;
//
//   @required()
//   @index()
//   name!: string;
//
//   @oneToMany(
//     TestDummyPhone,
//     { update: Cascade.CASCADE, delete: Cascade.CASCADE },
//     false
//   )
//   phones!: TestDummyPhone[];
//
//   constructor(m?: ModelArg<NoPopulateManyModel>) {
//     super(m);
//   }
// }

export function testCountry(country: TestCountryModel) {
  expect(country).toBeDefined();
  expect(country).toBeInstanceOf(TestCountryModel);
  expect(country.id).toBeDefined();
  expect(country.createdOn).toBeDefined();
  expect(country.updatedOn).toBeDefined();
}

export function testAddress(address: TestAddressModel) {
  expect(address).toBeDefined();
  expect(address).toBeInstanceOf(TestAddressModel);
  expect(address.id).toBeDefined();
  expect(address.createdOn).toBeDefined();
  expect(address.updatedOn).toBeDefined();
  testCountry(address.country as TestCountryModel);
}
