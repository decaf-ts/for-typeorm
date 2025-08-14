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
import {
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from "typeorm";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";
import { OneToOne } from "../../src/overrides/OneToOne";
import { JoinColumn } from "../../src/overrides/JoinColumn";

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

class BaseModel extends Model {
  @CreateDateColumn()
  createdOn!: Date;
  @UpdateDateColumn()
  updateOn!: Date;

  constructor(arg?: ModelArg<BaseModel>) {
    super(arg);
  }
}

@Entity()
class TypeORMVanillaChild extends BaseModel {
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

@Entity()
class TypeORMVanilla extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column()
  @prop()
  firstName!: string;

  @Column()
  @prop()
  lastName!: string;

  @OneToOne(() => TypeORMVanillaChild, {
    cascade: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    nullable: true,
  })
  @JoinColumn()
  @prop()
  child!: TypeORMVanillaChild;

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
        entities: [TypeORMVanilla, TypeORMVanillaChild],
      }) as DataSourceOptions
    );
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

  let child: TypeORMVanillaChild;

  it.only("creates a record child vanilla", async () => {
    const repo = dataSource.getRepository(TypeORMVanillaChild);
    expect(repo).toBeDefined();
    const toCreate = new TypeORMVanillaChild({
      firstName: "JohnChild2",
      lastName: "DoeChild2",
    });

    child = await repo.save(toCreate);
    expect(child).toBeDefined();
  });

  it("creates a record parent vanilla with previous created child", async () => {
    const repo = dataSource.getRepository(TypeORMVanilla);
    expect(repo).toBeDefined();
    const toCreate = new TypeORMVanilla({
      firstName: "John2",
      lastName: "Doe2",
      child: child,
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
  });

  it("creates a record vanilla nested", async () => {
    const repo = dataSource.getRepository(TypeORMVanilla);
    expect(repo).toBeDefined();
    const toCreate = new TypeORMVanilla({
      firstName: "John3",
      lastName: "Doe3",
      child: new TypeORMVanillaChild({
        firstName: "JohnChild3",
        lastName: "DoeChild3",
      }),
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
  });
});
