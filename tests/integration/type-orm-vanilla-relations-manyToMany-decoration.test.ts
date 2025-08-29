import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter } from "../../src";
import { DataSource, DataSourceOptions } from "typeorm";

let con: DataSource;
const admin = "alfred";
const admin_password = "password";
const user = "orm_vanilla_many_relations_decoration_user";
const user_password = "password";
const dbName = "orm_vanilla_many_relations_decoration_db";
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

import { Cascade, column, manyToMany, pk, table, uses } from "@decaf-ts/core";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import {
  model,
  ModelArg,
  ModelKeys,
  required,
} from "@decaf-ts/decorator-validation";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMFlavour } from "../../src";

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

@uses(TypeORMFlavour)
@table("type_orm_many_child_decaf")
@model()
class TypeORMChildDecaf extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;
  @column()
  @required()
  text!: string;

  constructor(arg?: ModelArg<TypeORMChildDecaf>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("type_orm_many_parent_decaf")
@model()
class TypeORMParentDecaf extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @manyToMany(
    () => TypeORMChildDecaf,
    {
      update: Cascade.CASCADE,
      delete: Cascade.CASCADE,
    },
    true
  )
  children: TypeORMChildDecaf[];

  constructor(arg?: ModelArg<TypeORMParentDecaf>) {
    super(arg);
  }
}

describe("TypeORM decaf many to many Relations decoration", () => {
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
        entities: [
          TypeORMChildDecaf[ModelKeys.ANCHOR],
          TypeORMParentDecaf[ModelKeys.ANCHOR],
        ],
      }) as DataSourceOptions
    );
    try {
      await dataSource.initialize();
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await dataSource.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let child: TypeORMChildDecaf;

  it("creates a record child decaf", async () => {
    const repo = dataSource.getRepository(TypeORMChildDecaf[ModelKeys.ANCHOR]);
    expect(repo).toBeDefined();
    const toCreate = Object.assign(new TypeORMChildDecaf(), {
      text: "text 1",
    });

    child = await repo.save(toCreate);
    expect(child).toBeDefined();
  });

  it("creates a record parent decaf with previous created child", async () => {
    const repo = dataSource.getRepository(TypeORMParentDecaf[ModelKeys.ANCHOR]);
    expect(repo).toBeDefined();
    const toCreate = Object.assign(new TypeORMParentDecaf(), {
      children: [child],
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
  });

  let created: TypeORMParentDecaf;

  it("creates a record decaf nested", async () => {
    const repo = dataSource.getRepository(TypeORMParentDecaf[ModelKeys.ANCHOR]);
    expect(repo).toBeDefined();
    const toCreate = Object.assign(new TypeORMParentDecaf(), {
      children: [
        Object.assign(new TypeORMChildDecaf(), {
          text: "text nested",
        }),
      ],
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
    created = record;
  });

  it("read a record decaf nested", async () => {
    const repo = dataSource.getRepository(TypeORMParentDecaf[ModelKeys.ANCHOR]);
    expect(repo).toBeDefined();
    const record = await repo.findOneBy({
      id: created.id,
    });
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });
});
