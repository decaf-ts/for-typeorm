import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter } from "../../src";
let con: DataSource;
const adapter = new TypeORMAdapter(con);

import {
  Observer,
  PersistenceKeys,
  pk,
  Repository,
  table,
  uses,
} from "@decaf-ts/core";
import {
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { TypeORMBaseModel } from "./baseModel";

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

jest.setTimeout(50000);

const dbName = "bulk_db";

jest.setTimeout(50000);

describe("Bulk operations", () => {
  let con: DataSource;

  @uses("type-orm")
  @table("tst_bulk_model")
  @model()
  class TestBulkModel extends TypeORMBaseModel {
    @pk()
    id?: number = undefined;

    @required()
    @minlength(5)
    attr1?: string = undefined;

    constructor(arg?: ModelArg<TestBulkModel>) {
      super(arg);
    }
  }

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
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    con = await TypeORMAdapter.connect(
      Object.assign({}, config, {
        user: user,
        password: user_password,
        database: dbName,
      })
    );

    adapter["_native" as keyof typeof TypeORMAdapter] = con;

    try {
      await TypeORMAdapter.createTable(con, TestBulkModel);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
  });

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

  afterAll(async () => {
    await con.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let created: TestBulkModel[];
  let updated: TestBulkModel[];

  it.skip("creates one", async () => {
    const repo: TypeORMRepository<TestBulkModel> =
      Repository.forModel(TestBulkModel);
    const created = await repo.create(
      new TestBulkModel({
        attr1: "attr1",
      })
    );
    expect(created).toBeDefined();
  });

  it("Creates in bulk", async () => {
    const repo: TypeORMRepository<TestBulkModel> =
      Repository.forModel(TestBulkModel);
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
    const repo: TypeORMRepository<TestBulkModel> =
      Repository.forModel(TestBulkModel);
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
    const repo: TypeORMRepository<TestBulkModel> =
      Repository.forModel(TestBulkModel);
    const toUpdate = created.map((c, i) => {
      return new TestBulkModel({
        id: c.id,
        attr1: "updated_name_" + i,
      });
    });
    const c = created;
    updated = await repo.updateAll(toUpdate);
    expect(updated).toBeDefined();
    expect(Array.isArray(updated)).toEqual(true);
    expect(updated.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(updated.every((el) => !el.hasErrors())).toEqual(true);
    expect(updated.every((el, i) => !el.equals(created[i]))).toEqual(true);
  });

  it("Deletes in Bulk", async () => {
    const repo: TypeORMRepository<TestBulkModel> =
      Repository.forModel(TestBulkModel);
    const ids = created.map((c) => c.id);
    const deleted = await repo.deleteAll(ids as number[]);
    expect(deleted).toBeDefined();
    expect(Array.isArray(deleted)).toEqual(true);
    expect(deleted.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(deleted.every((el) => !el.hasErrors())).toEqual(true);
    expect(deleted.every((el, i) => el.equals(updated[i]))).toEqual(true);
    for (const k in created.map((c) => c.id)) {
      await expect(repo.read(k)).rejects.toThrowError(NotFoundError);
    }
  });
});
