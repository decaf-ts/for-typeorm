import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter } from "../../src";
let con: DataSource;
const admin = "alfred";
const admin_password = "password";
const user = "orm_vanilla_relations_decoration_user";
const user_password = "password";
const dbName = "orm_vanilla_relations_decoration_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const adapter = new TypeORMAdapter(config);

import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMVanillaRel } from "./models/vanilla/TypeORMVanillaRel";
import { TypeORMVanillaChildRel } from "./models/vanilla/TypeORMVanillaChildRel";

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

describe("TypeORM Vanilla Relations decoration", () => {
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
      con = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
    dataSource = new DataSource(
      Object.assign({}, typeOrmCfg, {
        entities: [TypeORMVanillaRel, TypeORMVanillaChildRel],
      }) as DataSourceOptions
    );
    await dataSource.initialize();
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await dataSource.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let child: TypeORMVanillaChildRel;

  it("creates a record child vanilla", async () => {
    const repo = dataSource.getRepository(TypeORMVanillaChildRel);
    expect(repo).toBeDefined();
    const toCreate = Object.assign(new TypeORMVanillaChildRel(), {
      firstName: "JohnChild2",
      lastName: "DoeChild2",
    });

    child = await repo.save(toCreate);
    expect(child).toBeDefined();
  });

  it("creates a record parent vanilla with previous created child", async () => {
    const repo = dataSource.getRepository(TypeORMVanillaRel);
    expect(repo).toBeDefined();
    const toCreate = Object.assign(new TypeORMVanillaRel(), {
      firstName: "John2",
      lastName: "Doe2",
      child: [child],
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
  });

  let created: TypeORMVanillaRel;

  it("creates a record vanilla nested", async () => {
    const repo = dataSource.getRepository(TypeORMVanillaRel);
    expect(repo).toBeDefined();
    const toCreate = Object.assign(new TypeORMVanillaRel(), {
      firstName: "John3",
      lastName: "Doe3",
      child: [
        Object.assign(new TypeORMVanillaChildRel(), {
          firstName: "JohnChild3",
          lastName: "DoeChild3",
        }),
      ],
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
    created = record;
  });

  it("read a record vanilla nested", async () => {
    const repo = dataSource.getRepository(TypeORMVanillaRel);
    expect(repo).toBeDefined();
    const record = await repo.findOneBy({
      id: created.id,
    });
    expect(record).toBeDefined();
  });
});
