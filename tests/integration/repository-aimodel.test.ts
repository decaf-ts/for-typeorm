import { TypeORMAdapter } from "../../src";

import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "repo2_user";
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
const dbName = "repository_aimodel";

let con: DataSource;
let adapter: TypeORMAdapter;

import { Observer, Repo, Repository } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { AIFeature } from "./models/AIFeature";
import { AIFeatures } from "./models/contants";

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

describe("AIFeature", () => {
  let repo: Repo<AIFeature>;

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
    repo = Repository.forModel(AIFeature);
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

  let created: AIFeature, updated: AIFeature;

  it("creates", async () => {
    const model = new AIFeature({
      name: AIFeatures.SUMMARIZATION,
      description:
        "Shorten one or more documents into a concise version that keeps the main points and meaning",
    });

    created = await repo.create(model);

    expect(created).toBeDefined();
    expect(created.hasErrors()).toBeUndefined();
    // await new Promise((resolve) => setTimeout(resolve, 10000));
    // expect(mock).toHaveBeenCalledWith(
    //   Repository.table(AIFeature),
    //   OperationKeys.CREATE,
    //   [created.id]
    // );
  });

  it("reads", async () => {
    const read = await repo.read(created.name);

    expect(read).toBeDefined();
    expect(read.equals(created)).toEqual(true); // same model
    expect(read === created).toEqual(false); // different instances
  });

  it("updates", async () => {
    const toUpdate = new AIFeature(
      Object.assign({}, created, {
        description: "new description",
      })
    );

    updated = await repo.update(toUpdate);

    expect(updated).toBeDefined();
    expect(updated.equals(created)).toEqual(false);
  });

  it("deletes", async () => {
    const deleted = await repo.delete(created.name);
    expect(deleted).toBeDefined();
    expect(deleted.equals(updated)).toEqual(true);

    await expect(repo.read(created.name)).rejects.toThrow(NotFoundError);
  });
});
