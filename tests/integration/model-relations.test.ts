import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter } from "../../src";
const admin = "alfred";
const admin_password = "password";
const user = "complex_user";
const user_password = "password";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
  ssl: false,
};
let con: DataSource;
let adapter: TypeORMAdapter;

import {
  testAddress,
  TestAddressModel,
  testCountry,
  TestCountryModel,
  TestDummyCountry,
  TestDummyPhone,
} from "./models";
import {
  Model,
  ModelArg,
  ModelKeys,
  required,
  model,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import {
  Cascade,
  Condition,
  manyToMany,
  Observer,
  table,
  column,
  pk,
  uses,
} from "@decaf-ts/core";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { TestPhoneModel, testPhone } from "./models/TestModelPhone";
import { TestUserModel, testUser } from "./models/TestUserModel";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMFlavour } from "../../src";

const dbName = "complex_db";

Model.setBuilder(Model.fromModel);

jest.setTimeout(500000);

const typeOrmCfg: DataSourceOptions = {
  type: "postgres",
  host: dbHost,
  port: 5432,
  username: user,
  password: user_password,
  database: dbName,
  synchronize: true,
  logging: false,
};

@uses(TypeORMFlavour)
@table("tst_section")
@model()
class TestSection extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_section_text")
  @required()
  text!: string;

  constructor(arg?: ModelArg<TestSection>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_text")
@model()
class TestText extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @required()
  @manyToMany(
    () => TestSection,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  sections!: TestSection[];

  constructor(arg?: ModelArg<TestText>) {
    super(arg);
  }
}

describe(`Complex Database`, function () {
  beforeAll(async () => {
    con = await TypeORMAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await TypeORMAdapter.deleteDatabase(con, dbName, user);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.deleteUser(con, user, admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.createDatabase(con, dbName);
      await con.destroy();
      con = await TypeORMAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await TypeORMAdapter.createUser(con, dbName, user, user_password);
      await TypeORMAdapter.createNotifyFunction(con, user);
      await con.destroy();
      con = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
    adapter = new TypeORMAdapter(typeOrmCfg);
    try {
      await adapter.initialize();
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let observer: Observer;
  let mock: any;
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
    jest.resetAllMocks();
    mock = jest.fn();
    observer = new (class implements Observer {
      refresh(...args: any[]): Promise<void> {
        return mock(...args);
      }
    })();
    // repo.observe(observer);
  });
  //
  // afterEach(() => {
  //   repo.unObserve(observer);
  // });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let userRepository: TypeORMRepository<TestUserModel>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let testDummyCountryModelRepository: TypeORMRepository<TestDummyCountry>;
  let testPhoneModelRepository: TypeORMRepository<TestPhoneModel>;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let testDummyPhoneModelRepository: TypeORMRepository<TestDummyPhone>;
  let testAddressModelRepository: TypeORMRepository<TestAddressModel>;
  let testCountryModelRepository: TypeORMRepository<TestCountryModel>;
  // let noPopulateOnceModelRepository: TypeORMRepository<NoPopulateOnceModel>;
  // let noPopulateManyModelRepository: TypeORMRepository<NoPopulateManyModel>;

  let m: any;

  beforeAll(async () => {
    userRepository = new TypeORMRepository(adapter, TestUserModel);
    testPhoneModelRepository = new TypeORMRepository(adapter, TestPhoneModel);
    testAddressModelRepository = new TypeORMRepository(
      adapter,
      TestAddressModel
    );
    testCountryModelRepository = new TypeORMRepository(
      adapter,
      TestCountryModel
    );
    testDummyCountryModelRepository = new TypeORMRepository(
      adapter,
      TestDummyCountry
    );
    testDummyPhoneModelRepository = new TypeORMRepository(
      adapter,
      TestDummyPhone
    );
    // noPopulateOnceModelRepository = new TypeORMRepository(
    //   adapter,
    //   NoPopulateOnceModel
    // );
    // noPopulateManyModelRepository = new TypeORMRepository(
    //   adapter,
    //   NoPopulateManyModel
    // );

    m = {
      name: "test country",
      countryCode: "tst",
      locale: "ts_TS",
    };
  });

  describe("basic test", () => {
    let cached: TestCountryModel;

    it("creates a new record", async () => {
      const record = new TestCountryModel(m);
      const created = await testCountryModelRepository.create(record);
      expect(created).toBeDefined();
      expect(
        created.equals(
          record,
          "createdOn",
          "updatedOn",
          "createdBy",
          "updatedBy",
          "id",
          "version"
        )
      ).toEqual(true);
      expect(created.id).toEqual(1);
      cached = created;
    });

    it("reads a record", async () => {
      const read = await testCountryModelRepository.read(1);
      expect(read).toBeDefined();
      expect(read.equals(cached)).toEqual(true);
    });

    it("updates a record", async () => {
      const toUpdate = new TestCountryModel(
        Object.assign({}, cached, {
          name: "other test name",
        })
      );
      const updated = await testCountryModelRepository.update(toUpdate);
      const read = await testCountryModelRepository.read(1);
      expect(read).toBeDefined();
      expect(read.name).toEqual("other test name");
      expect(read.equals(updated)).toEqual(true);
      cached = read;
    });

    it("finds a record", async () => {
      const condition =
        Condition.attribute<TestCountryModel>("name").eq("other test name");
      const results: TestCountryModel[] = await testCountryModelRepository
        .select()
        .where(condition)
        .execute();
      expect(results).toBeDefined();
      expect(results.length).toEqual(1);
      expect(cached.equals(results[0])).toEqual(true);
    });

    it("deletes a record", async () => {
      const deleted = await testCountryModelRepository.delete(1);
      await expect(testCountryModelRepository.read(1)).rejects.toBeInstanceOf(
        NotFoundError
      );
      expect(deleted.equals(cached)).toEqual(true);
    });
  });

  describe("Complex relations Test", () => {
    describe("One to one relations", () => {
      let created: TestAddressModel;
      let updated: TestAddressModel;
      // it.skip("Ensure no population when populate is disabled in a one-to-one relation", async () => {
      //   const country = {
      //     name: "test country",
      //     countryCode: "tst",
      //     locale: "ts_TS",
      //   };
      //
      //   const address = new NoPopulateOnceModel({ country });
      //   const created = await noPopulateOnceModelRepository.create(address);
      //
      //   const read = await noPopulateOnceModelRepository.read(`${created.id}`);
      //
      //   created.country = new TestDummyCountry({
      //     name: "foo",
      //     countryCode: "foo",
      //     locale: "fo_FO",
      //   });
      //   const updated = await noPopulateOnceModelRepository.update(created);
      //
      //   const deleted = await noPopulateOnceModelRepository.delete(created.id);
      // });

      it("Creates a one to one relation", async () => {
        const address = new TestAddressModel({
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: m,
        });
        created = (await testAddressModelRepository.create(
          address
        )) as TestAddressModel;

        testAddress(created);

        const read = (await testAddressModelRepository.read(
          created.id
        )) as TestAddressModel;
        testAddress(read);
        expect(created.equals(read)).toEqual(true);
        expect(created.country.equals(read.country)).toEqual(true);

        const read2 = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(created.country)).toEqual(true);
      });

      it("Creates a one to one relation with nested entries", async () => {
        const address = new TestAddressModel({
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: {
            name: "test country",
            countryCode: "ta",
            locale: "ta_TA",
          },
        });
        created = (await testAddressModelRepository.create(
          address
        )) as TestAddressModel;

        testAddress(created);

        const read = (await testAddressModelRepository.read(
          created.id
        )) as TestAddressModel;
        testAddress(read);
        expect(created.equals(read)).toEqual(true);
        expect(created.country.equals(read.country)).toEqual(true);

        const read2 = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(created.country)).toEqual(true);
      });

      it("Updates a one to one relation", async () => {
        const address = new TestAddressModel(
          Object.assign({}, created, {
            city: "test city2",
            country: new TestCountryModel(
              Object.assign({}, created.country, {
                name: "other name",
              })
            ),
          })
        );
        updated = await testAddressModelRepository.update(address);
        testAddress(updated);

        const read = await testAddressModelRepository.read(updated.id);
        testAddress(read);
        expect(updated.equals(read)).toEqual(true);
        expect(updated.country.equals(read.country)).toEqual(true);

        const read2 = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(read2);
        expect(read2.equals(updated.country)).toEqual(true);
      });

      it("Deletes a one to one relation", async () => {
        const deleted = await testAddressModelRepository.delete(updated.id);
        testAddress(deleted);
        await expect(
          testAddressModelRepository.read(updated.id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });

      it.skip("Enforces delete cascade in children", async () => {
        await expect(
          testCountryModelRepository.read(updated.country.id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("One to many relations", () => {
      const user = {
        name: "testuser",
        email: "test@test.com",
        age: 25,
        address: {
          street: "test street",
          doorNumber: "test door",
          apartmentNumber: "test number",
          areaCode: "test area code",
          city: "test city",
          country: {
            name: "test country",
            countryCode: "tst",
            locale: "ts_TS",
          },
        },
        phones: [
          {
            areaCode: "351",
            phoneNumber: "000-0000000",
          },
          {
            areaCode: "351",
            phoneNumber: "000-0000001",
          },
        ],
      };

      let created: TestUserModel;
      let updated: TestUserModel;

      it("Creates a one to many relation", async () => {
        created = await userRepository.create(new TestUserModel(user));

        testUser(created);

        const read = await userRepository.read(created.id);
        testUser(read);

        const { address, phones } = read;
        expect(created.equals(read)).toEqual(true);
        expect(created.address.equals(address)).toEqual(true);

        const read2 = await testAddressModelRepository.read(created.address.id);
        testAddress(read2);
        expect(read2.equals(created.address)).toEqual(true);

        const read3 = await testCountryModelRepository.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address.country)).toEqual(true);

        for (let p of phones) {
          p = await testPhoneModelRepository.read(p.id);
          testPhone(p);
        }
      });

      it("Updates a one to many relation", async () => {
        // created = await userManager.create(new TestUserModel(user));
        const toUpdate = new TestUserModel(
          Object.assign({}, created, {
            name: "new name",
            address: Object.assign({}, created.address, {
              city: "new city",
              country: Object.assign({}, created.address?.country, {
                name: "new country",
              }),
            }),
            phones: [
              Object.assign({}, (created.phones as any[])[0], {
                areaCode: "352",
              }),
              Object.assign({}, (created.phones as any[])[1], {
                areaCode: "352",
              }),
            ],
          })
        );
        updated = await userRepository.update(toUpdate);
        testUser(updated);

        const read = await userRepository.read(updated.id);
        testUser(read);
        expect(read.name).toEqual("new name");

        const { address, phones } = read;
        expect(updated.equals(read)).toEqual(true);
        expect(updated.address.equals(address)).toEqual(true);
        const read2 = await testAddressModelRepository.read(updated.address.id);
        testAddress(read2);
        expect(read2.city).toEqual("new city");
        expect(read2.equals(updated.address)).toEqual(true);

        const read3 = await testCountryModelRepository.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address.country)).toEqual(true);
        expect(read3.name).toEqual("new country");

        phones.forEach((p: any) => {
          testPhone(p);
          expect(p.areaCode).toEqual("352");
        });
      });

      it.skip("Deletes a one to many relation", async () => {
        const deleted = await userRepository.delete(updated.id);
        testUser(deleted);
        await expect(
          testAddressModelRepository.read(updated.address.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testCountryModelRepository.read(updated.address.country.id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testPhoneModelRepository.read((updated.phones as any)[0].id)
        ).rejects.toBeInstanceOf(NotFoundError);
        await expect(
          testPhoneModelRepository.read((updated.phones as any)[1].id)
        ).rejects.toBeInstanceOf(NotFoundError);
      });
    });

    describe("Validate a key populate", () => {
      it("In a one-to-one relation", async () => {
        const country = await testCountryModelRepository.create(
          new TestCountryModel({
            name: "Portugal",
            countryCode: "pt",
            locale: "pt_PT",
          })
        );

        const address = new TestAddressModel({
          street: "5th Avenue",
          doorNumber: "517",
          apartmentNumber: "NA",
          areaCode: "646e",
          city: "New York",
          country: country,
        });
        const created = await testAddressModelRepository.create(address);

        expect(created.country).toEqual(expect.objectContaining(country));

        testAddress(created);

        const readAddress = await testAddressModelRepository.read(created.id);
        testAddress(readAddress);
        expect(created.equals(readAddress)).toEqual(true);
        expect(created.country.equals(readAddress.country)).toEqual(true);

        const readCountry = (await testCountryModelRepository.read(
          created.country.id
        )) as TestCountryModel;
        testCountry(readCountry);
        expect(readCountry.equals(created.country)).toEqual(true);
      });

      it("In a one-to-many relation", async () => {
        const country = await testCountryModelRepository.create(
          new TestCountryModel({
            name: "Italy",
            countryCode: "it",
            locale: "it_IT",
          })
        );

        const phone1 = await testPhoneModelRepository.create(
          new TestPhoneModel({
            areaCode: "51",
            phoneNumber: "510 899000010",
          })
        );

        const phone2 = await testPhoneModelRepository.create(
          new TestPhoneModel({
            areaCode: "59",
            phoneNumber: "059 901000900",
          })
        );

        const phoneIds = [phone1, phone2];

        const user = new TestUserModel({
          name: "Ronald",
          email: "ronald@test.com",
          age: 36,
          address: {
            street: "New avenue",
            doorNumber: "414e4",
            apartmentNumber: "404",
            areaCode: "51",
            city: "New Desert City",
            country: country,
          },
          phones: phoneIds,
        });

        const created: TestUserModel = await userRepository.create(user);

        expect(created.address.country).toEqual(
          expect.objectContaining(country)
        );

        testUser(created);

        const read = await userRepository.read(created.id);
        testUser(read);

        const { address, phones } = read;
        expect(created.equals(read)).toEqual(true);
        expect(created.address?.equals(address)).toEqual(true);

        const read2 = await testAddressModelRepository.read(created.address.id);
        testAddress(read2);
        expect(read2.equals(created.address)).toEqual(true);

        const read3 = await testCountryModelRepository.read(address.country.id);
        testCountry(read3);
        expect(read3.equals(address?.country)).toEqual(true);
        phones.forEach((p: any) => {
          testPhone(p);
        });
      });

      it.skip("Populate should fail when all elements do not match the same type", async () => {
        const country = await testCountryModelRepository.create(
          new TestCountryModel({
            name: "Spain",
            countryCode: "es",
            locale: "es_ES",
          })
        );

        const phone1 = await testPhoneModelRepository.create(
          new TestPhoneModel({
            areaCode: "49",
            phoneNumber: "490 899000010",
          })
        );

        const phoneIds = [
          phone1,
          {
            areaCode: "63",
            phoneNumber: "063 96310009",
          },
        ];

        const user = new TestUserModel({
          name: "Ronald",
          email: "ronald@test.com",
          age: 36,
          address: {
            street: "New avenue",
            doorNumber: "414e4",
            apartmentNumber: "404",
            areaCode: "51",
            city: "New Desert City",
            country: country.id,
          },
          phones: phoneIds,
        });

        let created: any = undefined;
        try {
          created = await userRepository.create(user);
        } catch (e: any) {
          expect(e?.message).toContain(
            "Invalid operation. All elements of property phones must match the same type."
          );
        }
        expect(created).toBeUndefined();
      });
    });

    describe.skip("many-to-many relations", () => {
      it("creates a many to many relation", async () => {
        const text = new TestText({
          sections: [
            new TestSection({
              text: "section1",
            }),
            new TestSection({
              text: "section2",
            }),
          ],
        });
        const repo = new TypeORMRepository(adapter, TestText);
        const created = await repo.create(text);
        expect(created).toBeDefined();
        expect(created.hasErrors()).toBeUndefined();
      });
    });
  });
});
