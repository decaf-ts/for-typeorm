import { TypeORMAdapter } from "../../src";
let con: DataSource;
const adapter = new TypeORMAdapter(con);

import "../../src/type-orm";
import { model, ModelArg, required } from "@decaf-ts/decorator-validation";
import { BaseModel, column, pk, table } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

const admin = "alfred";
const admin_password = "password";
const user = "other_user";
const user_password = "password";
const dbName = "test_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

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
