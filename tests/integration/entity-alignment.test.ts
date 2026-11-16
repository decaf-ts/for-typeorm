/**
 * TypeORM entities follow the decaf model metadata, for models defined after
 * the TypeORM decoration and for re-flavoured ones (the core TaskEngine
 * models, defined when `@decaf-ts/core` loads):
 *
 * - `@index()` → one index per distinct column list (no leaked compositions,
 *   no duplicates), so `synchronize` builds the schema;
 * - `@transient()` → no column;
 * - `@readonly()` → `update: false`.
 */
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { column, index, OrderDirection, pk, Repository, table } from "@decaf-ts/core";
import { TaskBuilder, TaskEventModel, TaskModel, TaskStatus } from "@decaf-ts/core/tasks";
import { uses } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError, readonly, transient } from "@decaf-ts/db-decorators";
import { Model, model, required, type ModelArg } from "@decaf-ts/decorator-validation";
import type { DataSource, DataSourceOptions } from "typeorm";

uses(TypeORMFlavour)(TaskModel);
uses(TypeORMFlavour)(TaskEventModel);

jest.setTimeout(60000);

@uses(TypeORMFlavour)
@table("align_item")
@model()
class AlignItemModel extends Model {
  @pk({ type: String, generated: false })
  id!: string;

  @column()
  @required()
  @index([OrderDirection.ASC, OrderDirection.DSC])
  @index([OrderDirection.ASC, OrderDirection.DSC], ["other"])
  status!: string;

  @column()
  other?: string;

  @column()
  @readonly()
  code?: string;

  @column()
  @transient()
  scratch?: string;

  constructor(arg?: ModelArg<AlignItemModel>) {
    super(arg);
  }
}

/** The same flags written above `@column` (applied after it). */
@uses(TypeORMFlavour)
@table("align_reversed")
@model()
class AlignReversedModel extends Model {
  @pk({ type: String, generated: false })
  id!: string;

  @index([OrderDirection.ASC, OrderDirection.DSC], ["kind"])
  @column()
  name?: string;

  @column()
  kind?: string;

  @readonly()
  @column()
  code?: string;

  @transient()
  @required()
  @column()
  scratch?: string;

  constructor(arg?: ModelArg<AlignReversedModel>) {
    super(arg);
  }
}

void AlignReversedModel; // registered entity, only checked through the schema

const admin: DataSourceOptions = {
  type: "postgres",
  username: process.env.TYPEORM_ADMIN_USER || "alfred",
  password: process.env.TYPEORM_ADMIN_PASSWORD || "password",
  database: process.env.TYPEORM_ADMIN_DATABASE || "alfred",
  host: process.env.TYPEORM_HOST || "localhost",
  port: Number(process.env.TYPEORM_PORT || "5432"),
};
const dbName = `entity_alignment_${Date.now().toString(36)}`;

describe("TypeORM entities follow the model metadata", () => {
  let adapter: TypeORMAdapter;
  let client: DataSource;

  /** Index column lists of a table, as Postgres has them. */
  async function indexes(tableName: string): Promise<string[]> {
    const rows: { def: string }[] = await client.query(
      `SELECT indexdef AS def FROM pg_indexes WHERE tablename = $1 AND indexname NOT LIKE 'PK_%'`,
      [tableName]
    );
    return rows
      .map((r) => /\((.*)\)/.exec(r.def)?.[1].replace(/"/g, "") ?? r.def)
      .sort();
  }

  async function columns(tableName: string): Promise<string[]> {
    const rows: { name: string }[] = await client.query(
      `SELECT column_name AS name FROM information_schema.columns WHERE table_name = $1`,
      [tableName]
    );
    return rows.map((r) => r.name).sort();
  }

  beforeAll(async () => {
    const con = await TypeORMAdapter.connect(admin);
    try {
      await TypeORMAdapter.createDatabase(con, dbName);
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    } finally {
      await con.destroy();
    }
    // synchronize builds the schema from the entities (it failed before on
    // TaskModel's duplicated index).
    adapter = new TypeORMAdapter({
      ...admin,
      database: dbName,
      synchronize: true,
      logging: false,
    } as DataSourceOptions);
    await adapter.initialize();
    client = adapter.client as DataSource;
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

  it("builds the declared indexes, single and composite, and nothing else", async () => {
    expect(await indexes("align_item")).toEqual(["status", "status, other"]);
    const task = await indexes("tasks");
    for (const expected of [
      "status",
      "status, nextRunAt",
      "status, leaseExpiry",
      "status, scheduledTo",
      "classification",
      "atomicity",
    ])
      expect(task).toContain(expected);
    // No composition leaked from another model or index.
    expect(task.filter((i) => i.includes("other"))).toEqual([]);
    expect(new Set(task).size).toBe(task.length);
  });

  it("does not depend on the decorators' order", async () => {
    expect(await indexes("align_reversed")).toEqual(["name, kind"]);
    expect(await columns("align_reversed")).not.toContain("scratch");
    const meta = client.getMetadata("align_reversed");
    expect(meta.findColumnWithPropertyName("code")?.isUpdate).toBe(false);
    expect(meta.findColumnWithPropertyName("name")?.isUpdate).toBe(true);
  });

  it("creates no column for @transient properties", async () => {
    expect(await columns("align_item")).not.toContain("scratch");
    expect(await columns("task_event")).not.toContain("uuid");
  });

  it("marks @readonly columns update: false", () => {
    const meta = client.getMetadata("align_item");
    expect(meta.findColumnWithPropertyName("code")?.isUpdate).toBe(false);
    expect(meta.findColumnWithPropertyName("status")?.isUpdate).toBe(true);
  });

  it("creates and updates core tasks and task events", async () => {
    const tasks = Repository.forModel(TaskModel, adapter.alias);
    const created = await tasks.create(
      new TaskBuilder().setClassification("align").setInput({ a: 1 }).setMaxAttempts(1).build()
    );
    const updated = await tasks.update(new TaskModel({ ...created, status: TaskStatus.RUNNING }));
    expect(updated.status).toBe(TaskStatus.RUNNING);

    const events = Repository.forModel(TaskEventModel, adapter.alias);
    const event = await events.create(
      new TaskEventModel({ taskId: created.id, classification: "status", payload: { s: 1 } })
    );
    expect(event.id.startsWith(`${created.id}:status:`)).toBe(true);
    expect((await events.read(event.id)).taskId).toBe(created.id);
  });

  it("round-trips a model with transient and readonly properties", async () => {
    const repo = Repository.forModel(AlignItemModel, adapter.alias);
    const created = await repo.create(
      new AlignItemModel({ id: "i1", status: "a", code: "c1", scratch: "not stored" })
    );
    expect(created.scratch).toBe("not stored");
    const read = await repo.read("i1");
    expect(read.scratch).toBeUndefined();
    expect(read.code).toBe("c1");
    const updated = await repo.update(new AlignItemModel({ ...read, status: "b" }));
    expect(updated.status).toBe("b");
    expect((await repo.read("i1")).code).toBe("c1");
  });
});
