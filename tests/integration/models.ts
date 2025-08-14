import {
  email,
  min,
  minlength,
  model,
  ModelArg,
  pattern,
  prop,
  required,
} from "@decaf-ts/decorator-validation";
import {
  Cascade,
  column,
  index,
  oneToMany,
  oneToOne,
  pk,
  table,
  uses,
} from "@decaf-ts/core";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMFlavour } from "../../src";

@uses(TypeORMFlavour)
@table("tst_country")
@model()
export class TestCountryModel extends TypeORMBaseModel {
  @pk()
  id!: number;

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
  @pk()
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

  @column("tst_city")
  @required()
  city!: string;

  @oneToOne(TestCountryModel)
  country!: TestCountryModel;

  constructor(m?: ModelArg<TestAddressModel>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_phone")
@model()
export class TestPhoneModel extends TypeORMBaseModel {
  @pk()
  id!: number;

  @column("tst_area_code")
  @required()
  areaCode!: string;

  @column("tst_phone_number")
  @required()
  phoneNumber!: string;

  constructor(m?: ModelArg<TestPhoneModel>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_user")
@model()
export class TestUserModel extends TypeORMBaseModel {
  @pk()
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

  @oneToOne(TestAddressModel, {
    update: Cascade.CASCADE,
    delete: Cascade.CASCADE,
  })
  address!: TestAddressModel;

  @oneToMany(TestPhoneModel, {
    update: Cascade.CASCADE,
    delete: Cascade.CASCADE,
  })
  phones!: TestPhoneModel[];

  constructor(m?: ModelArg<TestUserModel>) {
    super(m);
  }
}

@uses(TypeORMFlavour)
@table("tst_dummy_country")
@model()
export class TestDummyCountry extends TypeORMBaseModel {
  @pk()
  id!: number;

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
  @pk()
  id!: number;

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
  @pk()
  id!: number;
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
@uses(TypeORMFlavour)
@table("tst_no_populate_many")
@model()
export class NoPopulateManyModel extends TypeORMBaseModel {
  @pk()
  id!: number;

  @required()
  @index()
  name!: string;

  @oneToMany(
    TestDummyPhone,
    { update: Cascade.CASCADE, delete: Cascade.CASCADE },
    false
  )
  @required()
  @minlength(1)
  phones!: TestDummyPhone[];

  constructor(m?: ModelArg<NoPopulateManyModel>) {
    super(m);
  }
}

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

export function testPhone(p: TestPhoneModel) {
  expect(p).toBeInstanceOf(TestPhoneModel);
  expect(p.id).toBeDefined();
  expect(p.createdOn).toBeDefined();
  expect(p.updatedOn).toBeDefined();
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
