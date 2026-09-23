import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { Logging, LogLevel } from "@decaf-ts/logging";

const admin = "alfred";
const admin_password = "password";
const user = "exists_mixed_user";
const user_password = "password";
const dbHost = "localhost";
const dbName = "exists_mixed_db";

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
let adapter: TypeORMAdapter;

import {
  column,
  Condition,
  Context,
  pk,
  Repository,
  table,
} from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { TypeORMBaseModel } from "./baseModel";

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
@table("tst_exists_mixed")
@model()
class ExistsMixedEntity extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column("tst_exists_mixed_name")
  @required()
  name!: string;

  @column("tst_exists_mixed_nickname")
  nickname?: string;

  constructor(arg?: ModelArg<ExistsMixedEntity>) {
    super(arg);
  }
}

const WITH_NICKNAME = [1, 2, 3, 4, 5, 6];
const WITHOUT_NICKNAME = [7, 8, 9, 10];

describe("EXISTS select returns the full list (mixed dataset)", () => {
  let repo: Repository<ExistsMixedEntity, any>;

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
        Object.assign({}, config, { database: dbName })
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

    repo = Repository.forModel(ExistsMixedEntity);

    await repo.createAll([
      ...WITH_NICKNAME.map(
        (id) =>
          new ExistsMixedEntity({
            id,
            name: `name_${id}`,
            nickname: `nick_${id}`,
          })
      ),
      ...WITHOUT_NICKNAME.map(
        (id) => new ExistsMixedEntity({ id, name: `name_${id}` })
      ),
    ]);
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  function ids(records: any[]): number[] {
    return records.map((r) => r.id).sort((a, b) => a - b);
  }

  it("returns the full positive list on the default path", async () => {
    const results = await repo
      .select()
      .where(Condition.attribute<ExistsMixedEntity>("nickname").exists())
      .execute();

    expect(Array.isArray(results)).toBe(true);
    expect(ids(results)).toEqual([...WITH_NICKNAME].sort((a, b) => a - b));
  });

  it("returns the full negated list on the default path", async () => {
    const results = await repo
      .select()
      .where(Condition.attribute<ExistsMixedEntity>("nickname").exists(false))
      .execute();

    expect(Array.isArray(results)).toBe(true);
    expect(ids(results)).toEqual([...WITHOUT_NICKNAME].sort((a, b) => a - b));
  });

  it("returns the full positive list under forcePrepareSimpleQueries", async () => {
    const results = await repo
      .override({ forcePrepareSimpleQueries: true })
      .select()
      .where(Condition.attribute<ExistsMixedEntity>("nickname").exists())
      .execute();

    expect(Array.isArray(results)).toBe(true);
    expect(ids(results)).toEqual([...WITH_NICKNAME].sort((a, b) => a - b));
  });

  it("returns the full negated list under forcePrepareSimpleQueries", async () => {
    const results = await repo
      .override({ forcePrepareSimpleQueries: true })
      .select()
      .where(Condition.attribute<ExistsMixedEntity>("nickname").exists(false))
      .execute();

    expect(Array.isArray(results)).toBe(true);
    expect(ids(results)).toEqual([...WITHOUT_NICKNAME].sort((a, b) => a - b));
  });

  it("returns the full positive list under forcePrepareComplexQueries", async () => {
    const results = await repo
      .override({ forcePrepareComplexQueries: true })
      .select()
      .where(Condition.attribute<ExistsMixedEntity>("nickname").exists())
      .execute();

    expect(Array.isArray(results)).toBe(true);
    expect(ids(results)).toEqual([...WITH_NICKNAME].sort((a, b) => a - b));
  });

  it("keeps list semantics for a complex AND containing an EXISTS leg", async () => {
    const results = await repo
      .override({ forcePrepareSimpleQueries: true })
      .select()
      .where(
        Condition.attribute<ExistsMixedEntity>("nickname")
          .exists()
          .and(Condition.attribute<ExistsMixedEntity>("name").exists())
      )
      .execute();

    expect(Array.isArray(results)).toBe(true);
    expect(ids(results)).toEqual([...WITH_NICKNAME].sort((a, b) => a - b));
  });

  it("pages the EXISTS select under the forced path", async () => {
    const paginator = await repo
      .override({ forcePrepareSimpleQueries: true })
      .select()
      .where(Condition.attribute<ExistsMixedEntity>("nickname").exists())
      .paginate(2);

    const ctx = new Context().accumulate({ logger: Logging.get() });

    const page1 = await paginator.page(1, ctx);
    expect(Array.isArray(page1)).toBe(true);
    expect(page1.length).toBe(2);
    expect(paginator.current).toBe(1);
  });

  it("keeps Repository.existsOf / existsNotOf boolean", async () => {
    await expect(repo.existsOf("nickname")).resolves.toBe(true);
    await expect(repo.existsNotOf("nickname")).resolves.toBe(true);
    await expect(repo.existsOf("name")).resolves.toBe(true);
    await expect(repo.existsNotOf("name")).resolves.toBe(false);
  });
});
