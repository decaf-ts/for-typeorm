import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter } from "../../src";
const admin = "alfred";
const admin_password = "password";
const user = "cross_user";
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
let adapter: TypeORMAdapter;

import {
  Model,
  ModelArg,
  required,
  model,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Observer, table, column, pk, uses, Repository } from "@decaf-ts/core";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMFlavour } from "../../src";

const dbName = "cross_db";

Model.setBuilder(Model.fromModel);

jest.setTimeout(500000);

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

@uses(TypeORMFlavour)
@table("tst_section")
@model()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class TestRelationCross extends TypeORMBaseModel {
  @column("tst_cross_id")
  @pk({ type: "Number" })
  id!: number;

  @column("tst_section_text")
  @required()
  text!: string;

  constructor(arg?: ModelArg<TestIdCross>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_section")
@model()
class TestIdCross extends TypeORMBaseModel {
  @column("tst_cross_id")
  @pk({ type: "Number" })
  id!: number;

  @column("tst_section_text")
  @required()
  text!: string;

  constructor(arg?: ModelArg<TestIdCross>) {
    super(arg);
  }
}

describe(`cross decoration`, function () {
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

  it("handles @column() in pk", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const repo = Repository.forModel(TestIdCross);
  });
});
