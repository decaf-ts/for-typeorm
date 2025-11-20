import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter } from "../../src";
let con: DataSource;
const admin = "alfred";
const admin_password = "password";
const user = "orm_vanilla_decoration_user";
const user_password = "password";
const dbName = "orm_vanilla_decoration_db";
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

import { Model, ModelArg } from "@decaf-ts/decorator-validation";
import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from "typeorm";
import { prop } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { DataSource, DataSourceOptions } from "typeorm";
import { BaseModel } from "./models/vanilla/BaseModel";

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
    eager: true,
  })
  @JoinColumn()
  @prop()
  child!: TypeORMVanillaChild;

  constructor(arg?: ModelArg<TypeORMVanilla>) {
    super();
    Model.fromModel(this as any, arg);
  }
}

@Entity()
class TypeORMChildVanilla extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;
  @Column({ nullabe: false })
  text!: string;

  constructor(arg?: ModelArg<TypeORMChildVanilla>) {
    super(arg);
    Model.fromObject(this, arg);
  }
}

@Entity()
class TypeORMParentVanilla extends BaseModel {
  @PrimaryGeneratedColumn()
  id!: number;

  @ManyToMany(() => TypeORMChildVanilla, (child) => child.id, {
    cascade: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
    eager: true,
  })
  @JoinTable()
  children: TypeORMVanillaChild[];

  constructor(arg?: ModelArg<TypeORMParentVanilla>) {
    super(arg);
    Model.fromObject(this as any, arg);
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
      con = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }
    dataSource = new DataSource(
      Object.assign({}, typeOrmCfg, {
        entities: [
          TypeORMVanilla,
          TypeORMVanillaChild,
          TypeORMChildVanilla,
          TypeORMParentVanilla,
        ],
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

  let child: TypeORMVanillaChild;

  it("creates a record child vanilla", async () => {
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

  let created: TypeORMVanilla;

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
    created = record;
  });

  it("read a record vanilla nested", async () => {
    const repo = dataSource.getRepository(TypeORMVanilla);
    expect(repo).toBeDefined();
    const record = await repo.findOneBy({
      id: created.id,
    });
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeDefined();
  });

  let manyToMany: TypeORMParentVanilla;
  it("creates a record vanilla many to many nested", async () => {
    const repo = dataSource.getRepository(TypeORMParentVanilla);
    expect(repo).toBeDefined();
    const toCreate = new TypeORMParentVanilla({
      children: [
        new TypeORMVanillaChild({
          text: "text1",
        }),
        new TypeORMVanillaChild({
          text: "text2",
        }),
      ],
    });

    const record = await repo.save(toCreate);
    expect(record).toBeDefined();
    manyToMany = record;
  });

  it("read a record vanilla many to many nested", async () => {
    const repo = dataSource.getRepository(TypeORMParentVanilla);
    expect(repo).toBeDefined();
    const record = await repo.findOneBy({
      id: manyToMany.id,
    });
    expect(record).toBeDefined();
    expect(record.hasErrors()).toBeDefined();
  });
});
