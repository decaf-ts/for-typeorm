import { TypeORMAdapter, TypeORMFlavour } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

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

let con: DataSource;
let adapter: TypeORMAdapter;

import {
  column,
  defaultQueryAttr,
  Observer,
  OrderDirection,
  pk,
  repository,
  Repository,
  SerializedPage,
  table,
} from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { Metadata } from "@decaf-ts/decoration";
import {
  ConflictError,
  Context,
  NotFoundError,
  OperationKeys,
} from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import {
  maxlength,
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";

jest.setTimeout(50000);

@uses(TypeORMFlavour)
@table("tst_user")
@model()
class TestModelRepo extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @column("tst_nif")
  @minlength(9)
  @maxlength(9)
  @required()
  nif!: string;

  constructor(arg?: ModelArg<TestModelRepo>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("default_query_models")
@model()
class DefaultQueryModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("dq_attr1")
  @required()
  @defaultQueryAttr()
  attr1!: string;

  @column("dq_attr2")
  @required()
  @defaultQueryAttr()
  attr2!: string;

  constructor(arg?: ModelArg<DefaultQueryModel>) {
    super(arg);
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
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("instatiates the model", () => {
    const m = new TestModelRepo({
      name: "test_name",
      nif: "123456789",
    });
    expect(m).toBeDefined();
    expect(m.name).toEqual("test_name");
    expect(m.nif).toEqual("123456789");
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

    repo.observe(observer);
    const toCreate = new TestModelRepo({
      name: "test_name",
      nif: "123456789",
    });

    created = await repo.create(toCreate);
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();

    expect(mock).toHaveBeenCalledTimes(1);
    expect(mock).toHaveBeenCalledWith(
      Metadata.constr(TestModelRepo),
      OperationKeys.CREATE,
      1,
      expect.any(Object),
      expect.any(Context)
    );
  });

  describe("default query find and page helpers", () => {
    const fixtures = () => [
      new DefaultQueryModel({ attr1: "apple", attr2: "zebra" }),
      new DefaultQueryModel({ attr1: "apricot", attr2: "alpha" }),
      new DefaultQueryModel({ attr1: "banana", attr2: "alpha" }),
      new DefaultQueryModel({ attr1: "delta", attr2: "aardvark" }),
    ];

    let defaultRepo: Repository<DefaultQueryModel>;
    let insertedKeys: number[] = [];

    beforeAll(() => {
      defaultRepo = Repository.forModel(DefaultQueryModel);
    });

    beforeEach(async () => {
      const existing = await defaultRepo.select().execute();
      const keysToDelete = existing
        .map((record) => record.id)
        .filter((id): id is number => typeof id !== "undefined");
      if (keysToDelete.length) {
        await defaultRepo.deleteAll(keysToDelete);
      }
      const created = await defaultRepo.createAll(fixtures());
      insertedKeys = created
        .map((record) => record.id)
        .filter((id): id is number => typeof id !== "undefined");
    });

    afterEach(async () => {
      if (insertedKeys.length) {
        await defaultRepo.deleteAll(insertedKeys);
        insertedKeys = [];
      }
    });

    it("finds records using the default attributes", async () => {
      const matches = await defaultRepo.find("ap", OrderDirection.ASC);
      expect(matches.map((record) => record.attr1)).toEqual([
        "apple",
        "apricot",
      ]);
      expect(
        matches.every(
          (record) =>
            record.attr1?.startsWith("ap") || record.attr2?.startsWith("ap")
        )
      ).toEqual(true);

      const stmtMatches = (await defaultRepo.statement(
        "find",
        "ap",
        "asc"
      )) as DefaultQueryModel[];
      expect(stmtMatches.map((record) => record.attr1)).toEqual(
        matches.map((record) => record.attr1)
      );
    });

    it("paginates using the default attributes", async () => {
      const pageResult = await defaultRepo.page("a", OrderDirection.DSC, {
        offset: 1,
        limit: 2,
      });
      expect(pageResult.data.length).toEqual(2);
      expect(
        pageResult.data.every(
          (record) =>
            record.attr1?.startsWith("a") || record.attr2?.startsWith("a")
        )
      ).toEqual(true);

      const stmtPage = (await defaultRepo.statement(
        "page",
        "a",
        "desc",
        {
          offset: 1,
          limit: 2,
        }
      )) as SerializedPage<DefaultQueryModel>;
      expect(stmtPage.data.map((record) => record.attr1)).toEqual(
        pageResult.data.map((record) => record.attr1)
      );
    });

    it("falls back to prepared find when raw statements are disabled", async () => {
      const prepared = defaultRepo.override({
        allowRawStatements: false,
        forcePrepareSimpleQueries: true,
        forcePrepareComplexQueries: false,
      });
      const matches = await prepared.find("ap", OrderDirection.ASC);
      expect(matches.map((record) => record.attr1)).toEqual([
        "apple",
        "apricot",
      ]);
    });

    it("falls back to prepared paging when raw statements are disabled", async () => {
      const prepared = defaultRepo.override({
        allowRawStatements: false,
        forcePrepareSimpleQueries: true,
        forcePrepareComplexQueries: false,
      });
      const pageResult = await prepared.page("a", OrderDirection.ASC, {
        offset: 1,
        limit: 2,
      });
      expect(pageResult.data.length).toEqual(2);
      expect(
        pageResult.data.every(
          (record) =>
            record.attr1?.startsWith("a") || record.attr2?.startsWith("a")
        )
      ).toEqual(true);
    });
  });
});
