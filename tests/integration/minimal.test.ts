import { TypeORMAdapter, TypeORMFlavour } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "repo_user_minimal";
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
const dbName = "repository_db_minimal";

let con: DataSource;
let adapter: TypeORMAdapter;

import {
  Adapter,
  column,
  createdAt,
  Observer,
  pk,
  Repository,
  table,
  updatedAt,
} from "@decaf-ts/core";
import { uses, Metadata } from "@decaf-ts/decoration";
import {
  ConflictError,
  Context,
  NotFoundError,
  OperationKeys,
} from "@decaf-ts/db-decorators";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { Model, model, ModelArg } from "@decaf-ts/decorator-validation";

jest.setTimeout(50000);

@uses(TypeORMFlavour)
@table("tst_user")
@model()
class TestModelRepo extends Model {
  @pk({ type: "Number" })
  id!: number;
  //
  // @column("tst_name")
  // @required()
  // name!: string;
  //
  // @column("tst_nif")
  // @minlength(9)
  // @maxlength(9)
  // @required()
  // nif!: string;
  //
  @column("created_on")
  @createdAt()
  createdAt!: Date;

  @column("updated_on")
  @updatedAt()
  updatedAt!: Date;

  constructor(arg?: ModelArg<TestModelRepo>) {
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

describe("minimal", () => {
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const models = Adapter.models(TypeORMFlavour);
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
});
