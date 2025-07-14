import { repository, Repository, uses } from "@decaf-ts/core";
import { TestModel } from "../TestModel";
import { ConflictError } from "@decaf-ts/db-decorators";
import { PostgresAdapter } from "../../src";
import { Pool, PoolConfig } from "pg";
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

const dbName = "repository_db";

jest.setTimeout(50000);

describe("repositories", () => {
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

  it("instantiates via constructor", () => {
    const repo: PostgresRepository<TestModel> = new Repository(
      adapter as any,
      TestModel
    );
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("instantiates via Repository.get with @uses decorator on model", () => {
    uses("nano")(TestModel);
    const repo = Repository.forModel(TestModel);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("gets injected when using @repository", () => {
    class TestClass {
      @repository(TestModel)
      repo!: PostgresRepository<TestModel>;
    }

    const testClass = new TestClass();
    expect(testClass).toBeDefined();
    expect(testClass.repo).toBeDefined();
    expect(testClass.repo).toBeInstanceOf(Repository);
  });
});
