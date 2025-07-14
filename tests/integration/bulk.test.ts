import {
  BaseModel,
  PersistenceKeys,
  pk,
  Repository,
  uses,
} from "@decaf-ts/core";
import {
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Pool, PoolConfig } from "pg";
import { PostgresAdapter } from "../../src";
import { PostgresRepository } from "../../src/PostgresRepository";

const admin = "postgres";
const admin_password = "password";
const user = "user";
const user_password = "password";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "postgres",
  host: dbHost,
  port: 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
};

const dbName = "bulk_db";

jest.setTimeout(50000);

describe("Bulk operations", () => {
  let con: Pool;
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    con = await PostgresAdapter.connect(config);
    expect(con).toBeDefined();
    try {
      await PostgresAdapter.createDatabase(con, dbName);
      await PostgresAdapter.createUser(con, dbName, user, user_password);
    } catch (e: any) {
      if (!(e instanceof ConflictError)) throw e;
    }
    adapter = new PostgresAdapter(con);
  });

  afterAll(async () => {
    await PostgresAdapter.deleteDatabase(con, dbName);
  });

  @uses("postgres")
  @model()
  class TestBulkModel extends BaseModel {
    @pk({ type: "Number" })
    id?: number = undefined;

    @required()
    @minlength(5)
    attr1?: string = undefined;

    constructor(arg?: ModelArg<TestBulkModel>) {
      super(arg);
    }
  }

  let created: TestBulkModel[];
  let updated: TestBulkModel[];

  it.skip("creates one", async () => {
    const repo: PostgresRepository<TestBulkModel> = Repository.forModel<
      TestBulkModel,
      PostgresRepository<TestBulkModel>
    >(TestBulkModel);
    const created = await repo.create(
      new TestBulkModel({
        attr1: "attr1",
      })
    );
    expect(created).toBeDefined();
  });

  it("Creates in bulk", async () => {
    const repo: PostgresRepository<TestBulkModel> = Repository.forModel<
      TestBulkModel,
      PostgresRepository<TestBulkModel>
    >(TestBulkModel);
    const models = [1].map(
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
    const repo: PostgresRepository<TestBulkModel> = Repository.forModel<
      TestBulkModel,
      PostgresRepository<TestBulkModel>
    >(TestBulkModel);
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
    const repo: PostgresRepository<TestBulkModel> = Repository.forModel<
      TestBulkModel,
      PostgresRepository<TestBulkModel>
    >(TestBulkModel);
    const toUpdate = created.map((c, i) => {
      return new TestBulkModel({
        id: c.id,
        attr1: "updated_name_" + i,
      });
    });
    updated = await repo.updateAll(toUpdate);
    expect(updated).toBeDefined();
    expect(Array.isArray(updated)).toEqual(true);
    expect(updated.every((el) => el instanceof TestBulkModel)).toEqual(true);
    expect(updated.every((el) => !el.hasErrors())).toEqual(true);
    expect(updated.every((el, i) => !el.equals(created[i]))).toEqual(true);
  });

  it("Deletes in Bulk", async () => {
    const repo: PostgresRepository<TestBulkModel> = Repository.forModel<
      TestBulkModel,
      PostgresRepository<TestBulkModel>
    >(TestBulkModel);
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
