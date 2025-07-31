import { TypeORMAdapter, TypeORMFlavour } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

let con: DataSource;
const adapter = new TypeORMAdapter(con);

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
import { TypeORMRepository } from "../../src/TypeORMRepository";
import {
  maxlength,
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";

const admin = "alfred";
const admin_password = "password";
const user = "repo_user";
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
const dbName = "repository_db";

jest.setTimeout(50000);

@uses(TypeORMFlavour)
@table("tst_user")
@model()
class TestModelRepo extends TypeORMBaseModel {
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
      await TypeORMAdapter.createTable(con, TestModelRepo);
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
    await con.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("instantiates via constructor", () => {
    const repo: TypeORMRepository<TestModelRepo> = new TypeORMRepository(
      adapter as any,
      TestModelRepo
    );
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("instantiates via Repository.get with @uses decorator on model", () => {
    uses(TypeORMFlavour)(TestModelRepo);
    const repo = Repository.forModel(TestModelRepo);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("gets injected when using @repository", () => {
    class TestClass {
      @repository(TestModelRepo)
      repo!: TypeORMRepository<TestModelRepo>;
    }

    const testClass = new TestClass();
    expect(testClass).toBeDefined();
    expect(testClass.repo).toBeDefined();
    expect(testClass.repo).toBeInstanceOf(Repository);
  });

  let created: TestModelRepo | undefined;

  it("creates a model", async () => {
    const repo: TypeORMRepository<TestModelRepo> =
      Repository.forModel(TestModelRepo);
    created = await repo.create(
      new TestModelRepo({
        name: "test_name",
        nif: "123456789",
      })
    );
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
  });
});
