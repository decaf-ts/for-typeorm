import { TypeORMAdapter } from "../../src";
import { DataSource, DataSourceOptions } from "typeorm";

const admin = "alfred";
const admin_password = "password";
const user = "orm_decoration_decaf_user";
const user_password = "password";
const dbName = "orm_decoration_decaf_db";
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
let adapter: TypeORMAdapter;

import {
  model,
  ModelArg,
  ModelKeys,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import {
  Cascade,
  column,
  oneToOne,
  pk,
  Repository,
  table,
  unique,
} from "@decaf-ts/core";
import { Metadata, uses } from "@decaf-ts/decoration";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMFlavour } from "../../src";

jest.setTimeout(50000);

const typeOrmCfg: DataSourceOptions = {
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
@table("type_orm_decaf_child")
@model()
class TypeORMDecafChild extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column()
  @unique()
  @required()
  firstName!: string;

  @column()
  @required()
  lastName!: string;

  constructor(arg?: ModelArg<TypeORMDecaf>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("type_orm_decaf")
@model()
class TypeORMDecaf extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  @column()
  @unique()
  @required()
  firstName!: string;

  @column()
  @required()
  lastName!: string;

  @oneToOne(TypeORMDecafChild, {
    update: Cascade.CASCADE,
    delete: Cascade.CASCADE,
  })
  child!: TypeORMDecafChild;

  constructor(arg?: ModelArg<TypeORMDecaf>) {
    super(arg);
  }
}

enum TestEnum {
  VALUE1 = "test",
  VALUES2 = "test2",
}

@uses(TypeORMFlavour)
@table("type_orm_enum")
@model()
class TypeORMEnum extends TypeORMBaseModel {
  @pk({ type: "String", generated: false })
  id!: TestEnum;

  @column()
  @required()
  name!: string;

  constructor(arg?: ModelArg<TypeORMEnum>) {
    super(arg);
  }
}

describe("TypeORM Decaf decoration", () => {
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
    adapter = new TypeORMAdapter(typeOrmCfg);
    try {
      await adapter.initialize();
    } catch (e: unknown) {
      console.error(e);
      throw e;
    }
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let child: TypeORMDecafChild;
  it("creates a record decaf child", async () => {
    const repo = adapter.client.getRepository(
      Metadata.constr(TypeORMDecafChild)
    );
    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecafChild({
      firstName: "JohnChild2",
      lastName: "DoeChild2",
    });
    child = await repo.save(toCreate);
    expect(child).toBeDefined();
    expect(child.hasErrors()).toBeUndefined();
  });

  it("creates a record decaf parent with existing child", async () => {
    const repo = adapter.client.getRepository(Metadata.constr(TypeORMDecaf));
    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John2",
      lastName: "Doe2",
      child: child,
    });
    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("creates a record decaf nested", async () => {
    const repo = adapter.client.getRepository(Metadata.constr(TypeORMDecaf));
    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John23",
      lastName: "Doe23",
      child: {
        firstName: "JohnChild23",
        lastName: "DoeChild23",
      },
    });
    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("creates a record decaf via adapter", async () => {
    const repo = Repository.forModel(TypeORMDecaf);

    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John3",
      lastName: "Doe3",
      child: {
        firstName: "JohnChild3",
        lastName: "DoeChild3",
      },
    });
    const record = await repo.create(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("creates a record decaf via Repository.forModel", async () => {
    const repo = Repository.forModel(TypeORMDecaf);

    expect(repo).toBeDefined();
    const toCreate = new TypeORMDecaf({
      firstName: "John4",
      lastName: "Doe4",
      child: {
        firstName: "JohnChild4",
        lastName: "DoeChild4",
      },
    });
    const record = await repo.create(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("creates a record decaf enum via Repository.forModel", async () => {
    const repo = Repository.forModel(TypeORMEnum);

    expect(repo).toBeDefined();
    const toCreate = new TypeORMEnum({
      id: TestEnum.VALUE1,
      name: "test",
    });
    const record = await repo.create(toCreate);
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeUndefined();
  });

  it("infers repos properly", async () => {
    const repo = Repository.forModel(TypeORMDecaf);
    await repo.select(["id"]).execute();
  });
});
