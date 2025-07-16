import { Pool, PoolConfig } from "pg";
import { PostgresAdapter, PostgresFlavour } from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);

import {
  column,
  Observer,
  pk,
  repository,
  Repository,
  table,
  unique,
  uses,
} from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { PostgresRepository } from "../../src/PostgresRepository";
import {
  maxlength,
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { PGBaseModel } from "./baseModel";

const admin = "postgres";
const admin_password = "password";
const user = "repo_user";
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
const dbName = "repository_db";

jest.setTimeout(50000);

@table("tst_user")
@model()
class TestModelRepo extends PGBaseModel {
  @pk()
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @column("tst_nif")
  @unique()
  @minlength(9)
  @maxlength(9)
  @required()
  nif!: string;

  constructor(arg?: ModelArg<TestModelRepo>) {
    super(arg);
  }
}

describe("repositories", () => {
  beforeAll(async () => {
    con = await PostgresAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await PostgresAdapter.deleteDatabase(con, dbName, user);
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
      await con.end();
      con = await PostgresAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await PostgresAdapter.createUser(con, dbName, user, user_password);
      await PostgresAdapter.createNotifyFunction(con, user);
      await con.end();
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

    adapter["_native" as keyof typeof PostgresAdapter] = con;

    try {
      await PostgresAdapter.createTable(con, TestModelRepo);
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
  //
  // afterEach(() => {
  //   repo.unObserve(observer);
  // });

  afterAll(async () => {
    await con.end();
    con = await PostgresAdapter.connect(config);
    await PostgresAdapter.deleteDatabase(con, dbName, user);
    await PostgresAdapter.deleteUser(con, user, admin);
    await con.end();
  });

  it("instantiates via constructor", () => {
    const repo: PostgresRepository<TestModelRepo> = new PostgresRepository(
      adapter as any,
      TestModelRepo
    );
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("instantiates via Repository.get with @uses decorator on model", () => {
    uses(PostgresFlavour)(TestModelRepo);
    const repo = Repository.forModel(TestModelRepo);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("gets injected when using @repository", () => {
    class TestClass {
      @repository(TestModelRepo)
      repo!: PostgresRepository<TestModelRepo>;
    }

    const testClass = new TestClass();
    expect(testClass).toBeDefined();
    expect(testClass.repo).toBeDefined();
    expect(testClass.repo).toBeInstanceOf(Repository);
  });
});
