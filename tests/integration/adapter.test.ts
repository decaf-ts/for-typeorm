import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";

const admin = "alfred";
const admin_password = "password";
const user = "other_user";
const user_password = "password";
const dbName = "test_adapter_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

let con: DataSource;
let adapter: TypeORMAdapter;

import {
  column,
  createdBy,
  Observer,
  pk,
  Repository,
  table,
  unique,
  updatedBy,
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
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

jest.setTimeout(50000);

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
@table("tst_user")
@model()
class TestModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
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

  @column()
  @createdBy()
  createdBy!: string;

  @column()
  @updatedBy()
  updatedBy!: string;

  constructor(arg?: ModelArg<TestModel>) {
    super(arg);
  }
}

describe("Adapter Integration", () => {
  let repo: TypeORMRepository<TestModel>;

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
    await adapter.initialize();
    repo = Repository.forModel(TestModel);
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

  it.skip("executes simple prepared statements", async () => {
    const tm = new TestModel({
      name: "test_name",
      nif: "123456789",
      createdOn: new Date(),
      updatedOn: new Date(),
    });

    const indexes: number[] = [];
    const values = Object.values(tm).filter((v, i) => {
      if (v !== undefined) {
        const type = typeof v;
        switch (type) {
          case "string":
            v = `"${v}"`;
            break;
          default:
          // do nothing
        }
        indexes.push(i);
      }
      return v !== undefined;
    });
    const keys = Object.keys(tm)
      .filter((k, i) => indexes.includes(i))
      .map((k) => Repository.column(tm, k));
    const response = await adapter.raw({
      query: `INSERT INTO ${Repository.table(TestModel)} (${keys.join(", ")}) VALUES (${values.map((v, i) => `$${i + 1}`)}) RETURNING *;`,
      values: values,
    });
    expect(response).toBeDefined();
  });

  it.skip("inserts functions", async () => {
    await con.query(
      `CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
      'table_changes',
      json_build_object(
          'table', TG_TABLE_NAME,
          'action', TG_OP,
          'data', row_to_json(NEW),
          'old_data', row_to_json(OLD)
      )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;`
    );
  });

  let created: TestModel, updated: TestModel;

  it("creates", async () => {
    const model = new TestModel({
      name: "test_name",
      nif: "123456789",
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
    // await new Promise((resolve) => setTimeout(resolve, 10000));
    // expect(mock).toHaveBeenCalledWith(
    //   Repository.table(TestModel),
    //   OperationKeys.CREATE,
    //   [model.id]
    // );
  });

  it("reads", async () => {
    const read = await repo.read(created.id as number);

    expect(read).toBeDefined();
    expect(read.equals(created)).toEqual(true); // same model
    expect(read === created).toEqual(false); // different instances
  });

  it("updates", async () => {
    const toUpdate = new TestModel(
      Object.assign({}, created, {
        name: "new_test_name",
      })
    );

    updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
    expect(updated.equals(created, "updatedOn", "name", "version")).toEqual(
      true
    ); // minus the expected changes
  });

  it("deletes", async () => {
    const deleted = await repo.delete(created.id as number);
    expect(deleted).toBeDefined();
    expect(deleted.equals(updated)).toEqual(true);

    await expect(repo.read(created.id as number)).rejects.toThrowError(
      NotFoundError
    );
  });
});
