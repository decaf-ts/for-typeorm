/**
 * A `@transient()` property is never persisted — even when it is also a
 * `@column()` (the core `TaskEventModel.uuid`, which only feeds its composed
 * primary key): the entity has no such column at all — and it is re-added to
 * the returned model on create.
 */
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { column, pk, Repository, table, uuid } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { composed, ConflictError, NotFoundError, readonly, transient } from "@decaf-ts/db-decorators";
import { Model, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import type { DataSourceOptions } from "typeorm";

jest.setTimeout(60000);

@uses(TypeORMFlavour)
@table("transient_event")
@model()
class TransientEventModel extends Model {
  @pk()
  @composed(["taskId", "uuid"], ":")
  id!: string;

  @column()
  @readonly()
  @required()
  @transient()
  @uuid(false)
  uuid!: string;

  @column()
  @required()
  taskId!: string;

  @column()
  note?: string;

  constructor(arg?: ModelArg<TransientEventModel>) {
    super(arg);
  }
}

const admin: DataSourceOptions = {
  type: "postgres",
  username: process.env.TYPEORM_ADMIN_USER || "alfred",
  password: process.env.TYPEORM_ADMIN_PASSWORD || "password",
  database: process.env.TYPEORM_ADMIN_DATABASE || "alfred",
  host: process.env.TYPEORM_HOST || "localhost",
  port: Number(process.env.TYPEORM_PORT || "5432"),
};
const dbName = `transient_persistence_${Date.now().toString(36)}`;

describe("transient properties are not persisted", () => {
  let adapter: TypeORMAdapter;

  beforeAll(async () => {
    const con = await TypeORMAdapter.connect(admin);
    try {
      await TypeORMAdapter.createDatabase(con, dbName);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    } finally {
      await con.destroy();
    }
    adapter = new TypeORMAdapter({
      ...admin,
      database: dbName,
      synchronize: true,
      logging: false,
    } as DataSourceOptions);
    await adapter.initialize();
  });

  afterAll(async () => {
    await adapter?.shutdown();
    const con = await TypeORMAdapter.connect(admin);
    try {
      await TypeORMAdapter.deleteDatabase(con, dbName);
    } catch (e: unknown) {
      if (!(e instanceof NotFoundError)) throw e;
    } finally {
      await con.destroy();
    }
  });

  it("creates and bulk-creates without storing the transient column", async () => {
    const repo = Repository.forModel(TransientEventModel, adapter.alias);
    const created = await repo.create(new TransientEventModel({ taskId: "t1" }));
    expect(created.uuid).toBeDefined();
    expect(created.id).toBe(`t1:${created.uuid}`);

    expect((await repo.read(created.id)).taskId).toBe("t1");

    const bulk = await repo.createAll([
      new TransientEventModel({ taskId: "t2" }),
      new TransientEventModel({ taskId: "t3" }),
    ]);
    expect(bulk).toHaveLength(2);

    const con = await TypeORMAdapter.connect({ ...admin, database: dbName } as DataSourceOptions);
    let stored: { n: number; u: number }[];
    try {
      stored = await con.query(
        `SELECT (SELECT COUNT(*)::int FROM transient_event) AS n,
                (SELECT COUNT(*)::int FROM information_schema.columns
                  WHERE table_name = 'transient_event' AND column_name = 'uuid') AS u`
      );
    } finally {
      await con.destroy();
    }
    expect(stored[0]).toEqual({ n: 3, u: 0 });
  });
});
