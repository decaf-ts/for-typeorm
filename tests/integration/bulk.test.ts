import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";

const admin = "alfred";
const admin_password = "password";
const user = "bulk_user";
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

import { column, Observer, PersistenceKeys, pk, table } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import {
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { TypeORMBaseModel } from "./baseModel";

const dbName = "bulk_db";

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
@table("tst_bulk_model")
@model()
class TestBulkModel extends TypeORMBaseModel {
  @column()
  @pk({ type: "Number" })
  id?: number = undefined;

  @column()
  @required()
  @minlength(5)
  attr1?: string = undefined;

  constructor(arg?: ModelArg<TestBulkModel>) {
    super(arg);
  }
}

describe("Bulk operations", () => {
  let repo: TypeORMRepository<TestBulkModel>;

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
    repo = new TypeORMRepository(adapter, TestBulkModel);
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

  let created: TestBulkModel[];
  let updated: TestBulkModel[];

  it("creates one", async () => {
    const created = await repo.create(
      new TestBulkModel({
        attr1: "attr1",
      })
    );
    expect(created).toBeDefined();
  });

  it("Creates in bulk", async () => {
    const models = [1, 2, 3, 4, 5].map(
      (i) =>
        new TestBulkModel({
          attr1: "user_name_" + i,
        })
    );
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(created.every((el) => !el.hasErrors())).toEqual(true);
  });

  it("Reads in Bulk", async () => {
    const ids = created.map((c) => c.id) as number[];
    const read = await repo.readAll(ids);
    expect(read).toBeDefined();
    expect(Array.isArray(read)).toEqual(true);
    expect(read.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(read.every((el) => !el.hasErrors())).toEqual(true);
    expect(read.every((el, i) => el.equals(created[i]))).toEqual(true);
    expect(read.every((el) => !!(el as any)[PersistenceKeys.METADATA]));
  });

  it("Updates in Bulk", async () => {
    const toUpdate = created.map((c, i) => {
      return new TestBulkModel({
        id: c.id,
        attr1: "updated_name_" + i,
      });
    });
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const c = created;
    updated = await repo.updateAll(toUpdate);
    expect(updated).toBeDefined();
    expect(Array.isArray(updated)).toEqual(true);
    expect(updated.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(updated.every((el) => !el.hasErrors())).toEqual(true);
    expect(updated.every((el, i) => !el.equals(created[i]))).toEqual(true);
  });

  it.skip("Deletes in Bulk", async () => {
    const ids = created.map((c) => c.id);
    const deleted = await repo.deleteAll(ids as number[]);
    expect(deleted).toBeDefined();
    expect(Array.isArray(deleted)).toEqual(true);
    expect(deleted.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(deleted.every((el) => !el.hasErrors())).toEqual(true);
    expect(deleted.every((el, i) => el.equals(updated[i]))).toEqual(true);
    for (const k in deleted.map((c) => c.id)) {
      await expect(repo.read(k)).rejects.toThrowError(NotFoundError);
    }
  });
});
