import { Observer, PersistenceKeys, Repository } from "@decaf-ts/core";
import { TestModel } from "../TestModel";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { PostgresAdapter } from "../../src";
import { Pool, PoolConfig } from "pg";
import { PostgresRepository } from "../../src/PostgresRepository";

const admin = "postgres";
const admin_password = "password";
const user = "other_user";
const user_password = "password";
const dbName = "test_db";
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

jest.setTimeout(50000);

describe("Adapter Integration", () => {
  let con: Pool;
  let adapter: PostgresAdapter;
  let repo: PostgresRepository<TestModel>;

  beforeAll(async () => {
    con = await PostgresAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await PostgresAdapter.deleteDatabase(con, dbName);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await PostgresAdapter.deleteUser(con, user, admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await PostgresAdapter.createDatabase(con, dbName);
      con = await PostgresAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await PostgresAdapter.createUser(con, dbName, user, user_password);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    con = await PostgresAdapter.connect(
      Object.assign({}, config, {
        user: user,
        password: user_password,
        database: dbName,
      })
    );

    try {
      await PostgresAdapter.createTable(con, TestModel);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    adapter = new PostgresAdapter(con);
    repo = new Repository(adapter, TestModel);
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
    repo.observe(observer);
  });

  afterEach(() => {
    repo.unObserve(observer);
  });

  afterAll(async () => {
    con = await PostgresAdapter.connect(config);
    await PostgresAdapter.deleteDatabase(con, dbName);
    await PostgresAdapter.deleteUser(con, user, admin);
  });

  let created: TestModel, updated: TestModel;

  it("creates", async () => {
    const model = new TestModel({
      id: Date.now(),
      name: "test_name",
      nif: "123456789",
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    const metadata = (created as any)[PersistenceKeys.METADATA];
    expect(metadata).toBeDefined();
    await new Promise((resolve) => setTimeout(resolve, 5000));
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
    const metadata = (read as any)[PersistenceKeys.METADATA];
    expect(metadata).toBeDefined();
  });

  it("updates", async () => {
    const toUpdate = new TestModel(
      Object.assign({}, created, {
        name: "new_test_name",
      })
    );

    updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
    expect(updated.equals(created, "updatedOn", "name")).toEqual(true); // minus the expected changes
    const metadata = (updated as any)[PersistenceKeys.METADATA];
    expect(metadata).toBeDefined();
  });

  it("deletes", async () => {
    const deleted = await repo.delete(created.id as number);
    expect(deleted).toBeDefined();
    expect(deleted.equals(updated)).toEqual(true);

    await expect(repo.read(created.id as number)).rejects.toThrowError(
      NotFoundError
    );

    const metadata = (deleted as any)[PersistenceKeys.METADATA];
    expect(metadata).toBeDefined();
  });

  it("bulk reads return metadata", async () => {});
});
