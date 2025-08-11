import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter } from "../../src";
let con: DataSource;
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

const adapter = new TypeORMAdapter(config);

import { Model, ModelArg, prop } from "@decaf-ts/decorator-validation";
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";

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

@Entity()
class TypeORMVanilla extends Model {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @prop()
  firstName!: string;

  @Column()
  @prop()
  lastName!: string;

  constructor(arg?: ModelArg<TypeORMVanilla>) {
    super();
    Model.fromModel(this as any, arg);
  }
}

describe("TypeORM Vanilla decoration", () => {
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
        entities: [TypeORMVanilla],
      }) as DataSourceOptions
    );
  });

  afterAll(async () => {
    await con.destroy();
    await dataSource.destroy();
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

  it("creates a record vanilla", async () => {
    const repo = dataSource.getRepository(TypeORMVanilla);
    expect(repo).toBeDefined();
    const toCreate = new TypeORMVanilla();
    toCreate.firstName = "John";
    toCreate.lastName = "Doe";
    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
  });
});
