/**
 * @description End-to-end regression for the lock-aware statement repository (DECAF-811).
 * @summary Proves that a statement carrying a `transactionLock` override is executed against
 * the lock's dedicated transactional connection (its EntityManager) instead of the adapter's
 * root DataSource connection. Uses same-transaction uncommitted-row visibility: a row inserted
 * through the lock's EntityManager (not yet committed) must be visible to a statement built with
 * that lock override, and must remain invisible to a lock-less statement until the transaction
 * commits. The lock-less path is the null-safe fallback regression the downstream patch got wrong.
 */
import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter, TypeORMContextLock, TypeORMFlavour } from "../../src";
import { column, pk, table } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";

jest.setTimeout(60000);

const admin = "alfred";
const admin_password = "password";
const user = "tx_statement_user";
const user_password = "password";
const dbName = "tx_statement_db";
const dbHost = process.env.TYPEORM_HOST || "localhost";
const dbPort = Number(process.env.TYPEORM_PORT || "5432");

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: dbPort,
} as PostgresConnectionOptions;

const typeOrmCfg: DataSourceOptions = {
  type: "postgres",
  host: dbHost,
  port: dbPort,
  username: user,
  password: user_password,
  database: dbName,
  synchronize: true,
  logging: false,
};

@uses(TypeORMFlavour)
@table("tst_tx_statement")
@model()
class TxStatementModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column()
  @required()
  name!: string;

  constructor(arg?: ModelArg<TxStatementModel>) {
    super(arg);
  }
}

describe("statements run on the transaction connection under an active TypeORMContextLock", () => {
  let con: DataSource | undefined;
  let adapter: TypeORMAdapter;

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
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("routes a lock-aware statement to the transaction connection (same-transaction visibility)", async () => {
    const lock = new TypeORMContextLock(adapter);
    await lock.begin();
    try {
      // insert through the transaction's own EntityManager - intentionally uncommitted
      const manager = lock.manager();
      expect(manager).toBeDefined();
      await (manager as NonNullable<typeof manager>).query(
        `INSERT INTO tst_tx_statement ("TxStatementModel_pk", "name", "version") VALUES (1, 'tx-only', 1)`
      );

      // a statement carrying the lock override must observe the uncommitted same-transaction row
      const locked = await adapter
        .Statement<TxStatementModel>({ transactionLock: lock })
        .from(TxStatementModel)
        .execute();
      expect(locked).toHaveLength(1);
      expect((locked as any)[0].name).toBe("tx-only");

      // the lock-less statement runs on the adapter root connection: must NOT see the row
      const unlocked = await adapter
        .Statement<TxStatementModel>()
        .from(TxStatementModel)
        .execute();
      expect(unlocked).toHaveLength(0);
    } finally {
      await lock.commit();
    }

    // after commit, the lock-less statement observes the row as well
    const afterCommit = await adapter
      .Statement<TxStatementModel>()
      .from(TxStatementModel)
      .execute();
    expect(afterCommit).toHaveLength(1);
  });

  it("keeps emitting one statement per select that resolves without any lock (regression)", async () => {
    const rows = await adapter
      .Statement<TxStatementModel>()
      .from(TxStatementModel)
      .execute();
    expect(rows).toHaveLength(1);
  });
});
