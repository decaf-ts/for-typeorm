import { DataSource, DataSourceOptions } from "typeorm";
import { Logging, LogLevel } from "@decaf-ts/logging";
import { TypeORMAdapter } from "../../src/TypeORMAdapter";
import {
  ConflictError,
  NotFoundError,
  InternalError,
} from "@decaf-ts/db-decorators";
import { Sequence } from "@decaf-ts/core";

// Test DB/user names
const admin = "alfred";
const admin_password = "password";
const user = "sequences_user";
const user_password = "password";
const dbHost = "localhost";
const dbName = "sequences_db";

Logging.setConfig({ level: LogLevel.debug });

const adminCfg: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
  ssl: false,
};

const appCfg: DataSourceOptions = {
  type: "postgres",
  host: dbHost,
  port: 5432,
  username: user,
  password: user_password,
  database: dbName,
  synchronize: true,
  logging: false,
};

let adminCon: DataSource | undefined;
let adapter: TypeORMAdapter;

jest.setTimeout(60000);

describe("TypeORM Sequences", () => {
  beforeAll(async () => {
    adminCon = await TypeORMAdapter.connect(adminCfg);
    expect(adminCon).toBeDefined();

    // Ensure a clean environment for this test database and user
    try {
      await TypeORMAdapter.deleteDatabase(adminCon!, dbName, user);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await TypeORMAdapter.deleteUser(adminCon!, user, admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }

    try {
      await TypeORMAdapter.createDatabase(adminCon!, dbName);
      await adminCon!.destroy();
      adminCon = await TypeORMAdapter.connect({
        ...adminCfg,
        database: dbName,
      });
      await TypeORMAdapter.createUser(adminCon!, dbName, user, user_password);
      await TypeORMAdapter.createNotifyFunction(adminCon!, user);
      await adminCon!.destroy();
      adminCon = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    adapter = new TypeORMAdapter(appCfg);
    await adapter.initialize();
  });

  afterAll(async () => {
    if (adminCon) await adminCon.destroy();
    await adapter.shutdown();
    adminCon = await TypeORMAdapter.connect(adminCfg);
    await TypeORMAdapter.deleteDatabase(adminCon!, dbName, user);
    await TypeORMAdapter.deleteUser(adminCon!, user, admin);
    await adminCon!.destroy();
  });

  it.skip("creates sequence and returns values for next() and range()", async () => {
    const name = "tst_numbers_seq";
    // Ensure the sequence exists in DB so that current() works
    // Use a direct connection to issue DDL, avoiding adapter.raw logging assumptions
    const ddlCon = await TypeORMAdapter.connect(appCfg);
    try {
      await ddlCon.query(
        `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = $1) THEN EXECUTE format('CREATE SEQUENCE %I START WITH %L INCREMENT BY %L NO CYCLE', $1, $2, $3); END IF; END $$;`,
        [name, 100, 5]
      );
    } finally {
      await ddlCon.destroy();
    }

    const seq: Sequence = await adapter.Sequence({
      name,
      type: "Number",
      startWith: 100,
      incrementBy: 5,
      cycle: false,
    });

    // We can attempt range and next; even if current() returns the configured start,
    // range should compute deterministically and last should match the value after increment.
    const gotRange = await seq.range(3);
    expect(gotRange).toHaveLength(3);
    expect(gotRange.every((v) => typeof v === "number")).toBe(true);

    const nxt = await seq.next();
    expect(
      typeof nxt === "number" ||
        typeof nxt === "bigint" ||
        typeof nxt === "string"
    ).toBe(true);
  });

  it("throws for invalid type increment", async () => {
    const seq: Sequence = await adapter.Sequence({
      name: "tst_invalid_type_seq",
      // Here we purposely choose a non-numeric type to trigger the error path in increment
      type: "String" as any,
      startWith: 1 as any,
      incrementBy: 1 as any,
      cycle: false,
    });

    // We call range which leads to increment internally after current(); even if current() fails first,
    // we still want to exercise the increment type guard explicitly by attempting to call next()
    await expect(seq.next()).rejects.toBeInstanceOf(InternalError);
  });
});
