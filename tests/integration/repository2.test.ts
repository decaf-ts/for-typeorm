import { TypeORMAdapter, TypeORMFlavour } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "repo2_user";
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
const dbName = "repository2_db";

let con: DataSource;
let adapter: TypeORMAdapter;

import {
  column,
  Observer,
  pk,
  repository,
  Repository,
  table,
} from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import {
  model,
  ModelArg,
  pattern,
  required,
} from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";

jest.setTimeout(50000);

@uses(TypeORMFlavour)
@table("tst_repo_country")
@model()
export class TestCountryRepoModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @column("tst_country_code")
  @required()
  countryCode!: string;

  @column("tst_locale")
  @required()
  @pattern(/^[a-z]{2}_[A-Z]{2}$/)
  locale!: string;

  constructor(m?: ModelArg<TestCountryRepoModel>) {
    super(m);
  }
}

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

describe("repositories 2nd", () => {
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

  it("instatiates the model", () => {
    const m = new TestCountryRepoModel({
      name: "test_name",
      countryCode: "pt",
      locale: "pt_PT",
    });
    expect(m).toBeDefined();
    expect(m.name).toEqual("test_name");
    expect(m.locale).toEqual("pt_PT");
  });

  it("instantiates via constructor", () => {
    const repo: TypeORMRepository<TestCountryRepoModel> = new TypeORMRepository(
      adapter as any,
      TestCountryRepoModel
    );
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("instantiates via Repository.get with @uses decorator on model", () => {
    uses(TypeORMFlavour)(TestCountryRepoModel);
    const repo = Repository.forModel(TestCountryRepoModel);
    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repository);
  });

  it("gets injected when using @repository", () => {
    class TestClass {
      @repository(TestCountryRepoModel)
      repo!: TypeORMRepository<TestCountryRepoModel>;
    }

    const testClass = new TestClass();
    expect(testClass).toBeDefined();
    expect(testClass.repo).toBeDefined();
    expect(testClass.repo).toBeInstanceOf(Repository);
  });

  let created: TestCountryRepoModel | undefined;

  it("creates a model", async () => {
    const repo: TypeORMRepository<TestCountryRepoModel> =
      Repository.forModel(TestCountryRepoModel);

    const toCreate = new TestCountryRepoModel({
      name: "test_name",
      countryCode: "pt",
      locale: "pt_PT",
    });

    created = await repo.create(toCreate);
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
  });
});
