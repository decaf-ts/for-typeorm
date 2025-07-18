import { Pool, PoolConfig } from "pg";
import { PostgresAdapter, TypeORMRepository } from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);

import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Observer, OrderDirection, Paginator } from "@decaf-ts/core";
import { TestCountryModel } from "./models";
import { Repository } from "@decaf-ts/core";

const admin = "alfred";
const admin_password = "password";
const user = "pagination_user";
const user_password = "password";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
};
const dbName = "pagination_db";

jest.setTimeout(500000);

describe(`Pagination`, function () {
  let repo: TypeORMRepository<TestCountryModel>;

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
    repo = Repository.forModel(TestCountryModel);

    try {
      await PostgresAdapter.createTable(con, TestCountryModel);
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

  let created: TestCountryModel[];
  const size = 100;

  let selected: TestCountryModel[];

  it("Creates in bulk", async () => {
    const repo: TypeORMRepository<TestCountryModel> = Repository.forModel<
      TestCountryModel,
      TypeORMRepository<TestCountryModel>
    >(TestCountryModel);
    const models = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(
      (i) =>
        new TestCountryModel({
          age: Math.floor(18 + (i - 1) / 3),
          name: "user_name_" + i,
          countryCode: "M" + i,
          locale: "pt_PT",
        })
    );
    created = await repo.createAll(models);
    expect(created).toBeDefined();
    expect(Array.isArray(created)).toEqual(true);
    expect(created.every((el) => el instanceof TestCountryModel)).toEqual(true);
    expect(created.every((el) => !el.hasErrors())).toEqual(true);
  });

  it("Sorts via defined property when there is an index", async () => {
    selected = await repo
      .select()
      .orderBy(["id", OrderDirection.ASC])
      .execute();
    expect(selected).toBeDefined();
    expect(selected.length).toEqual(created.length);
    expect(created.every((c, i) => c.equals(selected[i]))).toEqual(true);
  });

  it.skip("paginates", async () => {
    const paginator: Paginator<TestCountryModel> = await repo
      .select()
      .orderBy(["id", OrderDirection.DSC])
      .paginate(10);

    expect(paginator).toBeDefined();

    expect(paginator.size).toEqual(10);
    expect(paginator.current).toEqual(undefined);

    const page1 = await paginator.page();
    expect(page1).toBeDefined();

    const ids = [100, 99, 98, 97, 96, 95, 94, 93, 92, 91];

    expect(page1.map((el: any) => el["id"])).toEqual(
      expect.arrayContaining(ids)
    );

    expect(paginator.current).toEqual(1);

    const page2 = await paginator.next();
    expect(page2).toBeDefined();

    expect(page2.map((el: any) => el["id"])).toEqual(
      expect.arrayContaining(ids.map((e) => e - 10))
    );

    const page3 = await paginator.next();
    expect(page3).toBeDefined();

    expect(page3.map((el: any) => el["id"])).toEqual(
      expect.arrayContaining(ids.map((e) => e - 20))
    );

    const page4 = await paginator.next();
    expect(page4).toBeDefined();

    expect(page4.map((el: any) => el["id"])).toEqual(
      expect.arrayContaining(ids.map((e) => e - 30))
    );

    expect(() => paginator.count).toThrow();
    expect(() => paginator.total).toThrow();
  });
});
