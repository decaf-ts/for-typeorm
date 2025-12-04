import { TypeORMAdapter, TypeORMFlavour } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "repo_user_serial";
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
const dbName = "repository_db_serial";

let con: DataSource;
let adapter: TypeORMAdapter;

import { column, Observer, pk, Repo, Repository, table } from "@decaf-ts/core";
import { Metadata, uses } from "@decaf-ts/decoration";
import {
  ConflictError,
  Context,
  NotFoundError,
  OperationKeys,
} from "@decaf-ts/db-decorators";
import {
  maxlength,
  minlength,
  Model,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";

jest.setTimeout(50000);

@uses(TypeORMFlavour)
@table("tst_user_serial")
@model()
export class TestModelSerial extends Model {
  @pk({ type: "serial" })
  id!: number;

  @column("tst_name")
  @required()
  name!: string;

  @column("tst_nif")
  // @unique()
  @minlength(9)
  @maxlength(9)
  @required()
  nif!: string;

  constructor(arg?: ModelArg<TestModelSerial>) {
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

describe("repositories serial", () => {
  let repo: Repo<TestModelSerial>;
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
    repo = Repository.forModel(TestModelSerial);
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
    repo.observe(observer);
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  afterEach(() => {
    repo.unObserve(observer);
  });

  let created: TestModelSerial;

  it("creates", async () => {
    const repo = Repository.forModel(TestModelSerial);
    const model = new TestModelSerial({
      name: "test_name",
      nif: "123456789",
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    expect(mock).toHaveBeenCalledWith(
      Metadata.constr(TestModelSerial),
      OperationKeys.CREATE,
      created.id,
      expect.any(Object),
      expect.any(Context)
    );
  });

  it("reads", async () => {
    const repo = Repository.forModel(TestModelSerial);
    const read = await repo.read(created.id);

    expect(read).toBeDefined();
    expect(read.equals(created)).toEqual(true); // same model
    expect(read === created).toEqual(false); // different instances
  });

  it("updates", async () => {
    const repo = Repository.forModel(TestModelSerial);
    const toUpdate = new TestModelSerial(
      Object.assign({}, created, {
        name: "new_test_name",
      })
    );

    const updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
    expect(updated.equals(created, "updatedAt", "name", "updatedBy")).toEqual(
      true
    ); // minus the expected changes
    expect(mock).toHaveBeenCalledWith(
      Metadata.constr(TestModelSerial),
      OperationKeys.UPDATE,
      updated.id,
      expect.any(Object),
      expect.any(Context)
    );
  });

  it("deletes", async () => {
    const repo = Repository.forModel(TestModelSerial);
    const deleted = await repo.delete(created.id);

    expect(deleted).toBeDefined();
    expect(deleted.id).toEqual(created.id); // same model
    await expect(repo.read(created.id)).rejects.toThrowError(NotFoundError);
    expect(mock).toHaveBeenCalledWith(
      Metadata.constr(TestModelSerial),
      OperationKeys.DELETE,
      "",
      {},
      expect.any(Context)
    );
  });
});
