import { TypeORMAdapter, TypeORMFlavour } from "../../src";

const admin = "alfred";
const admin_password = "password";
const user = "orm_decoration_user";
const user_password = "password";
const dbName = "orm_decoration_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

let con: DataSource;
const adapter = new TypeORMAdapter(config);

import {
  model,
  Model,
  ModelArg,
  ModelKeys,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { column, pk, Repository, table, uses } from "@decaf-ts/core";

jest.setTimeout(50000);

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

@table("type_orm_decaf")
@model()
class TypeORMDecaf extends Model {
  @pk()
  id!: number;

  @column()
  @required()
  firstName!: string;

  @column()
  @required()
  lastName!: string;

  constructor(arg?: ModelArg<TypeORMDecaf>) {
    super(arg);
  }
}

describe("TypeORM Decaf decoration", () => {
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
        entities: [TypeORMDecaf[ModelKeys.ANCHOR]],
      }) as DataSourceOptions
    );
  });

  afterAll(async () => {
    await con.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("Creates the table", async () => {
    await dataSource.initialize();
    // expect(
    //   await dataSource.query(
    //     `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'type_orm_decaf' );`
    //   )
    // ).toEqual([{ exists: true }]);
  });

  it("creates a record decaf", async () => {
    const repo = dataSource.getRepository(TypeORMDecaf[ModelKeys.ANCHOR]);
    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John2",
      lastName: "Doe2",
    });
    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("creates a record decaf via adapter", async () => {
    const repo = new (adapter.repository())(adapter, TypeORMDecaf);

    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John3",
      lastName: "Doe3",
    });
    const record = await repo.create(toCreate);
    expect(record).toBeDefined();
  });

  it("creates a record decaf via Repository.forModel", async () => {
    const repo = Repository.forModel(TypeORMDecaf);

    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John4",
      lastName: "Doe4",
    });
    const record = await repo.create(toCreate);
    expect(record).toBeDefined();
  });
});
