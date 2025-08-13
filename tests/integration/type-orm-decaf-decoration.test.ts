import { TypeORMAdapter } from "../../src";
import {
  Model,
  model,
  ModelArg,
  ModelKeys,
  required,
} from "@decaf-ts/decorator-validation";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";
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

@table("type_orm_decaf_child")
@model()
class TypeORMDecafChild extends Model {
  @pk()
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

@table("type_orm_decaf")
@model()
class TypeORMDecaf extends Model {
  @pk()
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
        entities: [
          TypeORMDecaf[ModelKeys.ANCHOR],
          TypeORMDecafChild[ModelKeys.ANCHOR],
        ],
      }) as DataSourceOptions
    );

    adapter["_dataSource"] = dataSource;
    await dataSource.initialize();
  });

  afterAll(async () => {
    await con.destroy();
    await dataSource.destroy();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  let child: TypeORMDecafChild;
  it("creates a record decaf child", async () => {
    const repo = dataSource.getRepository(TypeORMDecafChild[ModelKeys.ANCHOR]);
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
    const repo = dataSource.getRepository(TypeORMDecaf[ModelKeys.ANCHOR]);
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
    const repo = dataSource.getRepository(TypeORMDecaf[ModelKeys.ANCHOR]);
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
    const repo = new (adapter.repository())(adapter, TypeORMDecaf);

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
});
