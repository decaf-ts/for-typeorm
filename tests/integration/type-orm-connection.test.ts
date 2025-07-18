import { PostgresAdapter } from "../../src";
let con: Pool;
const adapter = new PostgresAdapter(con);

import "../../src/type-orm";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { BaseModel, column, pk, table } from "@decaf-ts/core";
import { Pool, PoolConfig } from "pg";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";

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

//
// @table("orm_phones")
// @model()
// class ORMPhone extends BaseModel {
//   @pk()
//   id!: number;
//
//   @column("orm_number")
//   @required()
//   number!: number;
//
//   constructor(arg?: ModelArg<ORMPhone>) {
//     super(arg);
//   }
// }

@table("orm_persons")
@model()
class ORMPerson extends BaseModel {
  @pk()
  id!: number;

  @column("orm_name")
  @required()
  name!: number;

  constructor(arg?: ModelArg<ORMPerson>) {
    super(arg);
  }
}

const typeOrmCfg = {
  type: "postgres",
  host: dbHost,
  port: 5432,
  username: user,
  password: user_password,
  database: dbName,
  synchronize: true,
  logging: false,
};

describe("TypeORM Decoration", () => {
  let dataSource: DataSource;

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
    dataSource = new DataSource(
      Object.assign({}, typeOrmCfg, {
        entities: [ORMPerson],
      }) as DataSourceOptions
    );

    await dataSource.initialize();
  });

  it("Creates an entity", () => {});
});
