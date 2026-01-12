import { uses } from "@decaf-ts/decoration";

import {
  Model,
  model,
  type ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { createdBy, Observer, pk, Repository } from "@decaf-ts/core";
import { ServerScope } from "nano";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import {
  TypeORMAdapter,
  TypeORMFlavour,
  TypeORMRepository,
} from "../../src/index";
import { NanoAdapter, NanoFlavour } from "@decaf-ts/for-nano";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { DataSource } from "typeorm";
@uses(TypeORMFlavour)
@model()
class Model1 extends Model {
  @pk({ type: "Number", generated: true })
  id1!: number;

  @required()
  name1!: string;

  @createdBy()
  owner1!: string;

  constructor(arg?: ModelArg<Model1>) {
    super(arg);
  }
}
@uses(NanoFlavour)
@model()
class Model2 extends Model {
  @pk({ type: "Number", generated: true })
  id2!: number;

  @required()
  name2!: string;

  @createdBy()
  owner2!: string;

  constructor(arg?: ModelArg<Model2>) {
    super(arg);
  }
}

const admin = "couchdb.admin";
const admin_password = "couchdb.admin";
const user = "couchdb.admin2";
const user_password = "couchdb.admin2";
const dbName = "test_db_multi_flavour";
const dbHost = "localhost:10010";

jest.setTimeout(50000);

const type_admin = "alfred";
const type_admin_password = "password";
const type_user = "other_user_multi_flavour_new";
const type_user_password = "password";
const type_dbName = "test_adapter_db_multi_flavour_new";
const type_dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: type_admin,
  password: type_admin_password,
  database: "alfred",
  host: type_dbHost,
  port: 5432,
} as PostgresConnectionOptions;

let con2: DataSource;

jest.setTimeout(50000);

const typeOrmCfg: DataSourceOptions = {
  type: "postgres",
  host: type_dbHost,
  port: 5432,
  username: type_user,
  password: type_user_password,
  database: type_dbName,
  synchronize: true,
  logging: false,
};

describe.skip("Adapter Integration", () => {
  let con: ServerScope;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let adapter: NanoAdapter;
  let typeAdapter: TypeORMAdapter;
  // let repo: NanoRepository<TestModel>;

  beforeAll(async () => {
    con = await NanoAdapter.connect(admin, admin_password, dbHost);
    expect(con).toBeDefined();
    try {
      await NanoAdapter.createDatabase(con, dbName);
      await NanoAdapter.createUser(con, dbName, user, user_password);
    } catch (e: any) {
      if (!(e instanceof ConflictError)) throw e;
    }
    adapter = new NanoAdapter({
      user: user,
      password: user_password,
      host: dbHost,
      dbName: dbName,
      protocol: "http",
    });

    con2 = await TypeORMAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await TypeORMAdapter.deleteDatabase(con2, type_dbName, type_user);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.deleteUser(con2, type_user, type_admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.createDatabase(con2, type_dbName);
      await con2.destroy();
      con2 = await TypeORMAdapter.connect(
        Object.assign({}, config, {
          database: type_dbName,
        })
      );
      await TypeORMAdapter.createUser(
        con2,
        type_dbName,
        type_user,
        type_user_password
      );
      await TypeORMAdapter.createNotifyFunction(con2, type_user);
      await con2.destroy();
      con2 = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
    typeAdapter = new TypeORMAdapter(typeOrmCfg);
    await typeAdapter.initialize();
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

  afterEach(() => {
    // repo.unObserve(observer);
  });

  afterAll(async () => {
    await NanoAdapter.deleteDatabase(con, dbName);
    if (con2)
      try {
        await con2.destroy();
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e: unknown) {
        // do nothing
      }
    await typeAdapter.shutdown();
    con2 = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con2, type_dbName, type_user);
    await TypeORMAdapter.deleteUser(con2, type_user, type_admin);
    await con2.destroy();
  });

  it("Reads default flavour correctly", async () => {
    const repo1 = Repository.forModel(Model1);
    expect(repo1).toBeDefined();
    expect(repo1["adapter"]).toBeInstanceOf(TypeORMAdapter);
    expect(repo1).toBeInstanceOf(TypeORMRepository);
    const repo2 = Repository.forModel(Model2);
    expect(repo2).toBeDefined();
    expect(repo2["adapter"]).toBeInstanceOf(NanoAdapter);

    const created2 = await repo2.create(
      new Model2({
        name2: "test2",
      })
    );

    expect(created2).toBeDefined();
    expect(created2.hasErrors()).toBeUndefined();
    expect(created2.owner2).toEqual(user);

    const created1 = await repo1.create(
      new Model1({
        name1: "test1",
      })
    );

    expect(created1).toBeDefined();
    expect(created1.hasErrors()).toBeUndefined();
    expect(created1.owner1).toEqual(type_user);
  });
});
