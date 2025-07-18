import { PostgresAdapter } from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);
import {
  column,
  Observer,
  pk,
  Repository,
  table,
  unique,
} from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Pool, PoolConfig } from "pg";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import {
  maxlength,
  minlength,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { PGBaseModel } from "./baseModel";

const admin = "alfred";
const admin_password = "password";
const user = "other_user";
const user_password = "password";
const dbName = "test_db";
const dbHost = "localhost";

const config: PoolConfig = {
  user: admin,
  password: admin_password,
  database: "alfred",
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
      await PostgresAdapter.deleteDatabase(con, dbName, user);
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
      await PostgresAdapter.createUser(con, dbName, user, user_password);
      await PostgresAdapter.createNotifyFunction(con, user);
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

  describe("TestModel", () => {
    @table("tst_user")
    @model()
    class TestModel extends PGBaseModel {
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

    let repo: TypeORMRepository<TestModel>;

    beforeAll(async () => {
      try {
        await PostgresAdapter.createTable(con, TestModel);
      } catch (e: unknown) {
        if (!(e instanceof ConflictError)) throw e;
      }
      repo = new TypeORMRepository(adapter, TestModel);
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
      // repo.observe(observer);
    });
    //
    // afterEach(() => {
    //   repo.unObserve(observer);
    // });

    afterAll(async () => {
      await con.end();
      con = await PostgresAdapter.connect(config);
      await PostgresAdapter.deleteDatabase(con, dbName, user);
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
      expect(updated.equals(created, "updatedOn", "name")).toEqual(true); // minus the expected changes
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
});
