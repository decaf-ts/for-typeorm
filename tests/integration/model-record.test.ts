import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";

const admin = "alfred";
const admin_password = "password";
const user = "other_user";
const user_password = "password";
const dbName = "test_adapter_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

let con: DataSource;
let adapter: TypeORMAdapter;

import { column, Observer, pk, Repository, table } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { uses } from "@decaf-ts/decoration";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { serialize } from "@decaf-ts/db-decorators";
import { TypeORMBaseModel } from "./baseModel";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

jest.setTimeout(50000);

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
@table("tst_object")
@model()
class TestObject extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column()
  @required()
  name!: string;

  @column()
  @required()
  @serialize()
  record!: Record<string, any>;

  constructor(arg?: ModelArg<TestObject>) {
    super(arg);
  }
}

describe("type override (serialize)", () => {
  let repo: TypeORMRepository<TestObject>;

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
    await adapter.initialize();
    repo = Repository.forModel(TestObject);
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

  let created: TestObject, updated: TestObject;

  it("creates", async () => {
    const model = new TestObject({
      name: "test_name",
      record: { test: "test" },
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
    expect(typeof created.record).toEqual("object");
    expect(created.record).toEqual(
      expect.objectContaining({
        test: created.record.test,
      })
    );
    // await new Promise((resolve) => setTimeout(resolve, 10000));
    // expect(mock).toHaveBeenCalledWith(
    //   Repository.table(TestModel),
    //   OperationKeys.CREATE,
    //   [model.id]
    // );
  });

  it("reads", async () => {
    const read = await repo.read(created.id as number);

    expect(read).toBeDefined();
    expect(read.equals(created)).toEqual(true); // same model
    expect(read === created).toEqual(false); // different instances
  });

  it("updates", async () => {
    const toUpdate = new TestObject(
      Object.assign({}, created, {
        record: { test: "other" },
      })
    );

    updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
    expect(updated.equals(created, "updatedOn", "record", "version")).toEqual(
      true
    ); // minus the expected changes
  });

  it("deletes", async () => {
    const deleted = await repo.delete(created.id as number);
    expect(deleted).toBeDefined();
    expect(deleted.equals(updated)).toEqual(true);

    await expect(repo.read(created.id as number)).rejects.toThrowError(
      NotFoundError
    );
  });
});
