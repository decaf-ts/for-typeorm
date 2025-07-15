import { PostgresAdapter } from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);
import {
  BaseModel,
  column,
  Observer,
  PersistenceKeys,
  pk,
  Repository,
  table,
  unique,
} from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Pool, PoolConfig } from "pg";
import { PostgresRepository } from "../../src/PostgresRepository";
import {
  maxlength,
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";

const admin = "postgres";
const admin_password = "password";
const user = "other_user";
const user_password = "password";
const dbName = "test_db";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "postgres",
  host: dbHost,
  port: 5432,
  ssl: false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
  statement_timeout: 10000,
};

jest.setTimeout(50000);

describe("Adapter Integration", () => {
  beforeAll(async () => {
    con = await PostgresAdapter.connect(config);
    expect(con).toBeDefined();

    try {
      await PostgresAdapter.deleteDatabase(con, dbName);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await PostgresAdapter.deleteUser(con, user, admin);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    }
    try {
      await PostgresAdapter.createDatabase(con, dbName);
      await con.end();
      con = await PostgresAdapter.connect(
        Object.assign({}, config, {
          database: dbName,
        })
      );
      await PostgresAdapter.createNotifyFunction(con);
      await PostgresAdapter.createUser(con, dbName, user, user_password);
      await con.end();
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    con = await PostgresAdapter.connect(
      Object.assign({}, config, {
        user: user,
        password: user_password,
        database: dbName,
      })
    );

    adapter["_native" as keyof typeof PostgresAdapter] = con;
  });

  describe("pg", () => {
    @table("tst_user")
    @model()
    class TestModel extends BaseModel {
      @pk()
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

      constructor(arg?: ModelArg<TestModel>) {
        super(arg);
      }
    }

    beforeAll(async () => {
      try {
        await PostgresAdapter.createTable(con, TestModel);
      } catch (e: unknown) {
        if (!(e instanceof ConflictError)) throw e;
      }
    });

    afterAll(async () => {
      await con.end();
      con = await PostgresAdapter.connect(config);
      await PostgresAdapter.deleteDatabase(con, dbName);
      await PostgresAdapter.deleteUser(con, user, admin);
      await con.end();
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
      const response = await adapter.raw(
        {
          query: `INSERT INTO ${Repository.table(TestModel)} (${keys.join(", ")}) VALUES (${values.map((v, i) => `$${i + 1}`)}) RETURNING *;`,
          values: values,
        },
        false
      );
      expect(response).toBeDefined();
    });

    it.only("inserts functions", async () => {
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
  });
});
