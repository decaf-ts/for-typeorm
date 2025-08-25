import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour, TypeORMRepository } from "../../src";
import { Logging, LogLevel } from "@decaf-ts/logging";

const admin = "alfred";
const admin_password = "password";
const user = "query_user";
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
Logging.setConfig({
  level: LogLevel.debug,
});
const adapter = new TypeORMAdapter(config);

import {
  column,
  Condition,
  index,
  Observer,
  OrderDirection,
  pk,
  Repository,
  table,
  uses,
} from "@decaf-ts/core";
import {
  min,
  minlength,
  Model,
  model,
  ModelArg,
  ModelKeys,
  required,
  type,
} from "@decaf-ts/decorator-validation";
import {
  ConflictError,
  NotFoundError,
  readonly,
} from "@decaf-ts/db-decorators";

import { TypeORMBaseModel } from "./baseModel";
const dbName = "queries_db";

jest.setTimeout(50000);

const typeOrmCfg = {
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
@table("tst_query_user")
@model()
class QueryUser extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_age")
  @required()
  @min(18)
  @index([OrderDirection.DSC, OrderDirection.ASC])
  age!: number;

  @column("tst_name")
  @required()
  @minlength(5)
  name!: string;

  @column("tst_sex")
  @required()
  @readonly()
  @type([String.name])
  sex!: "M" | "F";

  constructor(arg?: ModelArg<QueryUser>) {
    super(arg);
  }
}

describe("Queries", () => {
  let dataSource: DataSource;

  let repo: TypeORMRepository<QueryUser>;

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
    dataSource = new DataSource(
      Object.assign({}, typeOrmCfg, {
        entities: [QueryUser[ModelKeys.ANCHOR]],
      }) as DataSourceOptions
    );
    await dataSource.initialize();
    adapter["_dataSource"] = dataSource;
    repo = new TypeORMRepository(adapter, QueryUser);
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
    if (con) await con.destroy();
    await dataSource.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let created: QueryUser[] = [];
  const size = 20;

  it.skip("creates single model", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel<
      QueryUser,
      TypeORMRepository<QueryUser>
    >(QueryUser);
    const m = new QueryUser({
      age: 18,
      name: "single",
      sex: "M",
    });
    const created = await repo.create(m);
    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeFalsy();
  });

  it("Creates in bulk", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel<
      QueryUser,
      TypeORMRepository<QueryUser>
    >(QueryUser);
    const models = Object.keys(new Array(size).fill(0))
      .map((e) => parseInt(e) + 1)
      .map(
        (i) =>
          new QueryUser({
            age: Math.floor(18 + (i - 1) / 3),
            name: "user_name_" + i,
            sex: i % 2 === 0 ? "M" : "F",
          })
      );
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every((el) => el instanceof QueryUser)).toEqual(true);
    expect(created.every((el) => !el.hasErrors())).toEqual(true);
  });

  it("Performs simple queries - full object", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel(QueryUser);
    const selected = await repo.select().execute();
    expect(selected.length).toEqual(created.length);
    expect(
      created.every((c) => c.equals(selected.find((s: any) => (s.id = c.id))))
    );
  });

  it("Performs simple queries - attributes only", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel<
      QueryUser,
      TypeORMRepository<QueryUser>
    >(QueryUser);
    const selected = await repo.select(["age", "sex"]).execute();
    expect(selected).toEqual(
      expect.arrayContaining(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [...new Array(created.length)].map((e) =>
          expect.objectContaining({
            age: expect.any(Number),
            sex: expect.stringMatching(/^M|F$/g),
          })
        )
      )
    );
  });

  it("Performs conditional queries - full object", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel<
      QueryUser,
      TypeORMRepository<QueryUser>
    >(QueryUser);
    const condition = Condition.attribute<QueryUser>("age").eq(20);
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(created.filter((c) => c.age === 20).length);
  });

  it("Performs conditional queries - selected attributes", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel<
      QueryUser,
      TypeORMRepository<QueryUser>
    >(QueryUser);
    const condition = Condition.attribute<QueryUser>("age").eq(20);
    const selected = await repo
      .select(["age", "sex"])
      .where(condition)
      .execute();
    expect(selected.length).toEqual(created.filter((c) => c.age === 20).length);
    expect(selected).toEqual(
      expect.arrayContaining(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        [...new Array(created.length)].map((e: any) =>
          expect.objectContaining({
            age: expect.any(Number),
            sex: expect.stringMatching(/^M|F$/g),
          })
        )
      )
    );
  });

  it("Performs AND conditional queries - full object", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel<
      QueryUser,
      TypeORMRepository<QueryUser>
    >(QueryUser);
    const condition = Condition.attribute<QueryUser>("age")
      .eq(20)
      .and(Condition.attribute<QueryUser>("sex").eq("M"));
    const selected = await repo.select().where(condition).execute();
    expect(selected.length).toEqual(
      created.filter((c) => c.age === 20 && c.sex === "M").length
    );
  });

  it("Performs OR conditional queries - full object", async () => {
    const repo = Repository.forModel<QueryUser, TypeORMRepository<QueryUser>>(
      QueryUser
    );
    const condition = Condition.attribute<QueryUser>("age")
      .eq(20)
      .or(Condition.attribute<QueryUser>("age").eq(19));

    const tableName = Repository.table(QueryUser);

    const selected = await repo.select().where(condition).execute();
    // const selected = await repo
    //   .queryBuilder()
    //   .select(tableName)
    //   .from(QueryUser[ModelKeys.ANCHOR], tableName)
    //   .where(`${tableName}.age = :age1`, { age1: 20 })
    //   .orWhere(`${tableName}.age = :age2`, { age2: 19 })
    //   .getMany();
    expect(selected.length).toEqual(
      created.filter((c) => c.age === 20 || c.age === 19).length
    );
  });

  it("Sorts attribute", async () => {
    const repo: TypeORMRepository<QueryUser> = Repository.forModel(QueryUser);
    const sorted = await repo
      .select()
      .orderBy(["age", OrderDirection.DSC])
      .execute();
    expect(sorted).toBeDefined();
    expect(sorted.length).toEqual(created.length);

    expect(sorted[0]).toEqual(
      expect.objectContaining(created[created.length - 1])
    );
  });
});
