import { TypeORMAdapter, TypeORMRepository } from "../../src";

const admin = "alfred";
const admin_password = "password";
const user = "pagination_user";
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
const adapter = new TypeORMAdapter(config);

import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Observer, OrderDirection, Paginator } from "@decaf-ts/core";
import { TestCountryModel } from "./models";
import { Repository } from "@decaf-ts/core";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { DataSource } from "typeorm";
import { ModelKeys } from "@decaf-ts/decorator-validation";

const dbName = "pagination_db";

jest.setTimeout(500000);

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

describe(`Pagination`, function () {
  let dataSource: DataSource;

  let repo: TypeORMRepository<TestCountryModel>;

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
        entities: [TestCountryModel[ModelKeys.ANCHOR]],
      }) as DataSourceOptions
    );
    await dataSource.initialize();
    adapter["_dataSource"] = dataSource;
    repo = new TypeORMRepository(adapter, TestCountryModel);
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

  let created: TestCountryModel[];
  const size = 100;
  const pageSize = 10;
  let selected: TestCountryModel[];

  it("Creates in bulk", async () => {
    const repo: TypeORMRepository<TestCountryModel> = Repository.forModel<
      TestCountryModel,
      TypeORMRepository<TestCountryModel>
    >(TestCountryModel);
    const models = Object.keys(new Array(size).fill(0))
      .map((e) => parseInt(e) + 1)
      .map(
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

  it("paginates", async () => {
    const paginator: Paginator<TestCountryModel> = await repo
      .select()
      .orderBy(["id", OrderDirection.DSC])
      .paginate(pageSize);

    expect(paginator).toBeDefined();

    expect(paginator.size).toEqual(pageSize);
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

    expect(paginator.count).toEqual(created.length);
    expect(paginator.total).toEqual(Math.ceil(size / pageSize));
  });
});
