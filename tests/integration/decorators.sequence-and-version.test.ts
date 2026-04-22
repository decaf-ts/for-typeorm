import { DataSource, DataSourceOptions } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";

import { Model, model, type ModelArg } from "@decaf-ts/decorator-validation";
import {
  column,
  createdAt,
  pk,
  Repository,
  sequence,
  table,
  updatedAt,
  version,
  Context,
} from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import {
  BulkCrudOperationKeys,
  ConflictError,
  NotFoundError,
  OperationKeys,
} from "@decaf-ts/db-decorators";

const admin = "alfred";
const admin_password = "password";
const user = "decorators_seq_ver_user";
const user_password = "password";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
  ssl: false,
};

const dbName = "decorators_seq_ver_db";

let con: DataSource;
let adapter: TypeORMAdapter;

jest.setTimeout(60000);

class TypeORMDecoratedBaseModel extends Model {
  @column("created_on")
  @createdAt()
  createdAt!: Date;

  @column("updated_on")
  @updatedAt()
  updatedAt!: Date;

  constructor(arg?: ModelArg<TypeORMDecoratedBaseModel>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_persistent_version_typeorm")
@model()
class PersistentVersionTypeORMModel extends TypeORMDecoratedBaseModel {
  @column("tst_id")
  @pk({ type: Number, generated: false })
  id!: number;

  @column("tst_version")
  @version(true)
  version!: number;

  constructor(arg?: ModelArg<PersistentVersionTypeORMModel>) {
    super(arg);
  }
}

@uses(TypeORMFlavour)
@table("tst_sequence_per_instance_typeorm")
@model()
class SequencePerInstanceTypeORMModel extends TypeORMDecoratedBaseModel {
  @column("tst_id")
  @pk({ type: Number, generated: false })
  id!: number;

  @column("tst_step")
  @sequence({ type: Number })
  step!: number;

  constructor(arg?: ModelArg<SequencePerInstanceTypeORMModel>) {
    super(arg);
  }
}

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

describe("core decorators on typeorm adapter", () => {
  const versionRepo = () => Repository.forModel(PersistentVersionTypeORMModel);
  const seqRepo = () => Repository.forModel(SequencePerInstanceTypeORMModel);

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
      con = await TypeORMAdapter.connect({ ...config, database: dbName });
      await TypeORMAdapter.createUser(con, dbName, user, user_password);
      await TypeORMAdapter.createNotifyFunction(con, user);
      await con.destroy();
      con = undefined as any;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    adapter = new TypeORMAdapter(typeOrmCfg);
    await adapter.initialize();
  });

  afterAll(async () => {
    if (con) await con.destroy();
    await adapter?.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("@version(true) increments across update/delete/recreate for the same pk (and supports bulk ops)", async () => {
    const repo = versionRepo();

    const created = await repo.create(new PersistentVersionTypeORMModel({ id: 1 }));
    expect(created.version).toBe(1);

    const updateCtx1 = await Context.from(OperationKeys.UPDATE, {}, PersistentVersionTypeORMModel);
    const updated1 = await repo.update(new PersistentVersionTypeORMModel({ ...created }), updateCtx1 as any);
    expect(updated1.version).toBe(2);

    const updateCtx2 = await Context.from(OperationKeys.UPDATE, {}, PersistentVersionTypeORMModel);
    const updated2 = await repo.update(new PersistentVersionTypeORMModel({ ...updated1 }), updateCtx2 as any);
    expect(updated2.version).toBe(3);

    await repo.delete(updated2.id);

    const recreated = await repo.create(new PersistentVersionTypeORMModel({ id: 1 }));
    expect(recreated.version).toBe(4);

    const createAllCtx = await Context.from(BulkCrudOperationKeys.CREATE_ALL, {}, PersistentVersionTypeORMModel);
    const updateAllCtx = await Context.from(BulkCrudOperationKeys.UPDATE_ALL, {}, PersistentVersionTypeORMModel);

    const bulkCreated = await repo.createAll(
      [new PersistentVersionTypeORMModel({ id: 10 }), new PersistentVersionTypeORMModel({ id: 11 })],
      createAllCtx as any
    );
    expect(bulkCreated.map((m) => m.version)).toEqual([1, 1]);

    const bulkUpdated = await repo.updateAll(
      bulkCreated.map((m) => new PersistentVersionTypeORMModel({ ...m })),
      updateAllCtx as any
    );
    expect(bulkUpdated.map((m) => m.version)).toEqual([2, 2]);

    await repo.deleteAll([10, 11]);

    const bulkRecreated = await repo.createAll(
      [new PersistentVersionTypeORMModel({ id: 10 }), new PersistentVersionTypeORMModel({ id: 11 })],
      createAllCtx as any
    );
    expect(bulkRecreated.map((m) => m.version)).toEqual([3, 3]);

    await repo.deleteAll([10, 11]);
  });

  it("@sequence() is per-model-instance (pk + property), and seeds from provided value when allowGenerationOverride is true", async () => {
    const repo = seqRepo();

    let a = await repo.create(new SequencePerInstanceTypeORMModel({ id: 1 }));
    const b = await repo.create(new SequencePerInstanceTypeORMModel({ id: 2 }));

    expect(a.step).toBe(1);
    expect(b.step).toBe(1);

    await repo.delete(1);
    a = await repo.create(new SequencePerInstanceTypeORMModel({ id: 1 }));
    expect(a.step).toBe(2);

    const seedCtx = await Context.from(
      OperationKeys.CREATE,
      { allowGenerationOverride: true } as any,
      SequencePerInstanceTypeORMModel
    );
    const seeded = await repo.create(
      new SequencePerInstanceTypeORMModel({ id: 99, step: 10 }),
      seedCtx as any
    );
    expect(seeded.step).toBe(10);

    await repo.delete(99);
    const next = await repo.create(new SequencePerInstanceTypeORMModel({ id: 99 }));
    expect(next.step).toBe(11);
  });
});
