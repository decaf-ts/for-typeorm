import { TypeORMAdapter, TypeORMRepository } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "repository_inj";
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
const dbName = "repositoy_inj_db";

let con: DataSource;
let adapter: TypeORMAdapter;

import { Observer, pk, repository, Repository } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import {
  Model,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";

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

describe("repository injection", () => {
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
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("Properly injects a repository", async () => {
    @model()
    class RepoInjectionModel extends Model {
      @pk({ type: "Number" })
      id!: number;

      @required()
      name!: string;

      constructor(arg?: ModelArg<RepoInjectionModel>) {
        super(arg);
      }
    }

    @repository(RepoInjectionModel)
    class Repo extends TypeORMRepository<RepoInjectionModel> {
      constructor(adapter?: any) {
        super(adapter, RepoInjectionModel);
      }
    }

    const repo = Repository.forModel(RepoInjectionModel);

    expect(repo).toBeDefined();
    expect(repo).toBeInstanceOf(Repo);
  });
});
