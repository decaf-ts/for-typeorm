/**
 * @description End-to-end test of @transactional with deep nesting against live Postgres
 * @summary Verifies that 3+ levels of nested @transactional calls, each performing several real
 * create/read/update operations, all run inside exactly one native Postgres transaction (one
 * BEGIN/COMMIT pair for the whole call tree via TypeORMContextLock), regardless of nesting depth.
 * Proves it via the strongest available signal for a real database: if any nested level throws,
 * the native ROLLBACK discards every row written at every level - not just the failing one - and
 * a successful run durably commits every row from every level, visible from a brand new connection.
 */
import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { column, pk, table, transactional } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";

jest.setTimeout(60000);

const admin = "alfred";
const admin_password = "password";
const user = "tx_nested_user";
const user_password = "password";
const dbName = "tx_nested_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

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
@table("tst_tx_nested")
@model()
class NestedTxModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column()
  @required()
  name!: string;

  constructor(arg?: ModelArg<NestedTxModel>) {
    super(arg);
  }
}

class NestedTxRepository extends TypeORMRepository<NestedTxModel> {
  constructor(adapter: TypeORMAdapter) {
    super(adapter, NestedTxModel);
  }

  @transactional()
  async levelOne(...args: any[]): Promise<NestedTxModel[]> {
    const a = await this.create(
      new NestedTxModel({ id: 1, name: "l1-a" }),
      ...args
    );
    const b = await this.create(
      new NestedTxModel({ id: 2, name: "l1-b" }),
      ...args
    );
    const fromTwo = await this.levelTwo(...args);
    return [a, b, ...fromTwo];
  }

  @transactional()
  async levelTwo(...args: any[]): Promise<NestedTxModel[]> {
    const a = await this.create(
      new NestedTxModel({ id: 3, name: "l2-a" }),
      ...args
    );
    const b = await this.create(
      new NestedTxModel({ id: 4, name: "l2-b" }),
      ...args
    );
    const existing = await this.read(1, ...args);
    const updated = await this.update(
      new NestedTxModel(Object.assign({}, existing, { name: "l2-updated-1" })),
      ...args
    );
    const fromThree = await this.levelThree(...args);
    return [a, b, updated, ...fromThree];
  }

  @transactional()
  async levelThree(...args: any[]): Promise<NestedTxModel[]> {
    const a = await this.create(
      new NestedTxModel({ id: 5, name: "l3-a" }),
      ...args
    );
    const b = await this.create(
      new NestedTxModel({ id: 6, name: "l3-b" }),
      ...args
    );
    return [a, b];
  }

  @transactional()
  async levelTwoThatFails(...args: any[]): Promise<void> {
    await this.create(new NestedTxModel({ id: 7, name: "l2-fail-a" }), ...args);
    await this.levelThreeThatFails(...args);
  }

  @transactional()
  async levelThreeThatFails(...args: any[]): Promise<void> {
    await this.create(new NestedTxModel({ id: 8, name: "l3-fail-a" }), ...args);
    throw new Error("boom at the deepest level");
  }
}

describe("@transactional deep nesting against live Postgres", () => {
  let con: DataSource | undefined;
  let adapter: TypeORMAdapter;
  let repo: NestedTxRepository;

  beforeAll(async () => {
    con = await TypeORMAdapter.connect(config);
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
    repo = new NestedTxRepository(adapter);
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("commits every row from every nesting level as a single durable Postgres transaction", async () => {
    const results = await repo.levelOne();
    expect(results).toHaveLength(7);

    // open a brand new connection (independent of the adapter's pool) to confirm durability
    const verifyCon = await TypeORMAdapter.connect(
      Object.assign({}, config, { database: dbName })
    );
    try {
      const rows = await verifyCon.query(
        `SELECT "NestedTxModel_pk" AS id, name FROM tst_tx_nested ORDER BY "NestedTxModel_pk" ASC`
      );
      expect(rows).toHaveLength(6);
      const byId = new Map(rows.map((r: any) => [Number(r.id), r.name]));
      expect(byId.get(1)).toBe("l2-updated-1");
      expect(byId.get(2)).toBe("l1-b");
      expect(byId.get(3)).toBe("l2-a");
      expect(byId.get(4)).toBe("l2-b");
      expect(byId.get(5)).toBe("l3-a");
      expect(byId.get(6)).toBe("l3-b");
    } finally {
      await verifyCon.destroy();
    }
  });

  it("rolls back every row from every nesting level when the deepest level throws", async () => {
    await expect(repo.levelTwoThatFails()).rejects.toThrow(
      "boom at the deepest level"
    );

    const verifyCon = await TypeORMAdapter.connect(
      Object.assign({}, config, { database: dbName })
    );
    try {
      const rows = await verifyCon.query(
        `SELECT "NestedTxModel_pk" FROM tst_tx_nested WHERE "NestedTxModel_pk" IN (7, 8)`
      );
      // both the level-2 insert and the level-3 insert must be gone: one shared
      // transaction means the failure at the deepest level rolls back the whole tree.
      expect(rows).toHaveLength(0);
    } finally {
      await verifyCon.destroy();
    }
  });
});
