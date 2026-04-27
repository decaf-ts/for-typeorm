/* eslint-disable @typescript-eslint/no-unused-vars */
import { Adapter } from "@decaf-ts/core";
import {
  AbsMigration,
  migration,
  MigrationService,
} from "@decaf-ts/core/migrations";
import { RamAdapter } from "@decaf-ts/core/ram";
import { TaskEngine, TaskService } from "@decaf-ts/core/tasks";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { NanoAdapter } from "@decaf-ts/for-nano";
import { TypeORMAdapter } from "../../src";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";

jest.setTimeout(30_000);

const NANO_FLAVOUR = "nano-live-task-multi-from-typeorm";
const TYPEORM_FLAVOUR = "typeorm-live-task-multi";

const NANO_TABLE = "for_typeorm_task_multi_products";
const TYPEORM_TABLE = "for_typeorm_task_multi_prompts";

const nanoAdminUser = process.env.NANO_ADMIN_USER || "couchdb.admin";
const nanoAdminPassword = process.env.NANO_ADMIN_PASSWORD || "couchdb.admin";
const nanoHost = process.env.NANO_HOST || "localhost:10010";
const nanoProtocol = (process.env.NANO_PROTOCOL as "http" | "https") || "http";
const nanoCleanupDelayMs = Number(process.env.NANO_CLEANUP_DELAY_MS || "250");

const adminUser = process.env.TYPEORM_ADMIN_USER || "alfred";
const adminPassword = process.env.TYPEORM_ADMIN_PASSWORD || "password";
const adminDatabase = process.env.TYPEORM_ADMIN_DATABASE || "alfred";
const host = process.env.TYPEORM_HOST || "localhost";
const port = Number(process.env.TYPEORM_PORT || "5432");
const cleanupDelayMs = Number(process.env.TYPEORM_CLEANUP_DELAY_MS || "250");

const adminConfig: DataSourceOptions = {
  type: "postgres",
  username: adminUser,
  password: adminPassword,
  database: adminDatabase,
  host,
  port,
};

const failedOnce = new Set<string>();

function randomSuffix() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function waitForCleanup(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

async function createNanoTestResources(prefix: string) {
  const suffix = randomSuffix();
  const dbName = `${prefix}_${suffix}`;
  const user = `${prefix}_user_${suffix}`;
  const password = `${user}_pw`;
  const connection = NanoAdapter.connect(
    nanoAdminUser,
    nanoAdminPassword,
    nanoHost,
    nanoProtocol
  );
  await NanoAdapter.createDatabase(connection, dbName).catch((e: any) => {
    if (!(e instanceof ConflictError)) throw e;
  });
  await NanoAdapter.createUser(connection, dbName, user, password).catch(
    (e: any) => {
      if (!(e instanceof ConflictError)) throw e;
    }
  );
  return {
    connection,
    dbName,
    user,
    password,
    host: nanoHost,
    protocol: nanoProtocol,
  };
}

async function cleanupNanoTestResources(resources: {
  connection: any;
  dbName: string;
  user: string;
}) {
  try {
    await NanoAdapter.deleteDatabase(resources.connection, resources.dbName);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  }
  await waitForCleanup(nanoCleanupDelayMs);
  try {
    await NanoAdapter.deleteUser(
      resources.connection,
      resources.dbName,
      resources.user
    );
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  } finally {
    NanoAdapter.closeConnection(resources.connection);
  }
}

async function createTypeORMTestResources(prefix: string) {
  const suffix = randomSuffix();
  const dbName = `${prefix}_${suffix}`;
  const user = `${prefix}_user_${suffix}`;
  const password = `${user}_pw`;

  const adminConnection = await TypeORMAdapter.connect(adminConfig);
  try {
    await TypeORMAdapter.createDatabase(adminConnection, dbName);
  } catch (e: any) {
    if (!(e instanceof ConflictError)) throw e;
  } finally {
    await adminConnection.destroy();
  }

  const adminDbConfig: DataSourceOptions = { ...adminConfig, database: dbName };
  const adminDbConnection = await TypeORMAdapter.connect(adminDbConfig);
  try {
    await TypeORMAdapter.createUser(adminDbConnection, dbName, user, password);
    await TypeORMAdapter.createNotifyFunction(adminDbConnection, user);
  } finally {
    await adminDbConnection.destroy();
  }

  return { dbName, user, password };
}

async function cleanupTypeORMTestResources(resources: {
  dbName: string;
  user: string;
}) {
  const adminConnection = await TypeORMAdapter.connect(adminConfig);
  try {
    await TypeORMAdapter.deleteDatabase(
      adminConnection,
      resources.dbName,
      resources.user
    );
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  }
  await waitForCleanup(cleanupDelayMs);
  try {
    await TypeORMAdapter.deleteUser(adminConnection, resources.user, adminUser);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  } finally {
    await adminConnection.destroy();
  }
  await waitForCleanup(cleanupDelayMs);
}

class LiveNanoAdapter extends NanoAdapter {
  constructor(conf: any, alias?: string) {
    super(conf, alias);
    (this as any).flavour = NANO_FLAVOUR;
    (Adapter as any)._cache[NANO_FLAVOUR] = this;
  }
}

class LiveTypeormAdapter extends TypeORMAdapter {
  constructor(conf: any, alias?: string) {
    super(conf, alias);
    (this as any).flavour = TYPEORM_FLAVOUR;
    (Adapter as any)._cache[TYPEORM_FLAVOUR] = this;
  }
}

function failFirst(reference: string) {
  if (failedOnce.has(reference)) return;
  failedOnce.add(reference);
  throw new Error(`intentional failure for ${reference}`);
}

async function addAndBackfillNonNullColumn(
  dataSource: any,
  tableName: string,
  columnName: string,
  value: string
): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();
  await queryRunner.startTransaction();
  try {
    await queryRunner.query(
      `ALTER TABLE "${tableName}" ADD COLUMN "${columnName}" character varying`
    );
    await queryRunner.query(
      `UPDATE "${tableName}" SET "${columnName}" = $1 WHERE "${columnName}" IS NULL`,
      [value]
    );
    await queryRunner.query(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${columnName}" SET NOT NULL`
    );
    await queryRunner.commitTransaction();
  } catch (e: unknown) {
    await queryRunner.rollbackTransaction();
    throw e;
  } finally {
    await queryRunner.release();
  }
}

@migration("1.0.1-for-typeorm-live-task-hop-nano", "1.0.1", NANO_FLAVOUR)
class NanoMigrationHop101 extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }
  async up(): Promise<void> {
    return;
  }
  async down(): Promise<void> {
    return;
  }
  async migrate(qr: any): Promise<void> {
    const all = await qr.list({ include_docs: true });
    const docs = (all.rows || [])
      .map((row: any) => row.doc)
      .filter((doc: any) => doc && typeof doc._id === "string")
      .filter((doc: any) => doc._id.startsWith(`${NANO_TABLE}__`))
      .map((doc: any) => ({ ...doc, category: doc.category || "dairy" }));
    if (docs.length) await qr.bulk({ docs });
  }
}

@migration("1.0.2-for-typeorm-live-task-hop-nano", "1.0.2", NANO_FLAVOUR)
class NanoMigrationHop102 extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }
  async up(): Promise<void> {
    return;
  }
  async down(): Promise<void> {
    return;
  }
  async migrate(qr: any): Promise<void> {
    failFirst("1.0.2-for-typeorm-live-task-hop-nano");
    const all = await qr.list({ include_docs: true });
    const docs = (all.rows || [])
      .map((row: any) => row.doc)
      .filter((doc: any) => doc && typeof doc._id === "string")
      .filter((doc: any) => doc._id.startsWith(`${NANO_TABLE}__`))
      .map((doc: any) => ({ ...doc, stage: doc.stage || "stable" }));
    if (docs.length) await qr.bulk({ docs });
  }
}

@migration("1.0.1-for-typeorm-live-task-hop-typeorm", "1.0.1", TYPEORM_FLAVOUR)
class TypeormMigrationHop101 extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }
  async up(): Promise<void> {
    return;
  }
  async down(): Promise<void> {
    return;
  }
  async migrate(qr: any): Promise<void> {
    await addAndBackfillNonNullColumn(qr, TYPEORM_TABLE, "modelType", "llm");
  }
}

@migration("1.0.2-for-typeorm-live-task-hop-typeorm", "1.0.2", TYPEORM_FLAVOUR)
class TypeormMigrationHop102 extends AbsMigration<any> {
  protected getQueryRunner(conn: any): any {
    return conn;
  }
  async up(): Promise<void> {
    return;
  }
  async down(): Promise<void> {
    return;
  }
  async migrate(qr: any): Promise<void> {
    failFirst("1.0.2-for-typeorm-live-task-hop-typeorm");
    await addAndBackfillNonNullColumn(qr, TYPEORM_TABLE, "stage", "stable");
  }
}

describe("for-typeorm task migration with multi-adapter retries", () => {
  it("queues multi-adapter version-hop task chains and supports retries against live adapters", async () => {
    failedOnce.clear();

    const nanoResources = await createNanoTestResources(
      "for_typeorm_task_multi"
    );
    const typeormResources = await createTypeORMTestResources(
      "for_typeorm_task_multi"
    );

    const nano = new LiveNanoAdapter(
      {
        user: nanoResources.user,
        password: nanoResources.password,
        host: nanoResources.host,
        dbName: nanoResources.dbName,
        protocol: nanoResources.protocol,
      },
      NANO_FLAVOUR
    );

    const typeorm = new LiveTypeormAdapter(
      {
        type: "postgres",
        host,
        port,
        username: typeormResources.user,
        password: typeormResources.password,
        database: typeormResources.dbName,
        synchronize: false,
        logging: false,
      },
      TYPEORM_FLAVOUR
    );

    const taskAdapter = new RamAdapter({}, "for-typeorm-live-task-engine");
    const taskService = new TaskService<any>();
    let engine: TaskEngine<any> | undefined;

    const versions: Record<string, string> = {
      [NANO_FLAVOUR]: "1.0.0",
      [TYPEORM_FLAVOUR]: "1.0.0",
    };

    try {
      await nano.initialize();
      await typeorm.initialize();

      await nano.client.bulk({
        docs: [
          {
            _id: `${NANO_TABLE}__p-1`,
            id: "p-1",
            name: "milk",
          },
        ],
      });

      await typeorm.client.query(
        `CREATE TABLE "${TYPEORM_TABLE}" ("id" character varying PRIMARY KEY, "name" character varying NOT NULL)`
      );
      await typeorm.client.query(
        `INSERT INTO "${TYPEORM_TABLE}" ("id", "name") VALUES ($1, $2)`,
        ["r1", "draft"]
      );

      await taskAdapter.initialize();
      await taskService.boot({
        adapter: taskAdapter,
        pollMsIdle: 10,
        pollMsBusy: 10,
        leaseMs: 500,
      } as any);
      engine = taskService.client as TaskEngine<any>;
      await engine.start();

      const services = await MigrationService.migrateAdapters(
        [nano as any, typeorm as any],
        {
          taskMode: true,
          toVersion: "1.0.2",
          taskService: taskService as any,
          handlers: {
            [NANO_FLAVOUR]: {
              retrieveLastVersion: async () => versions[NANO_FLAVOUR],
              setCurrentVersion: async (version) => {
                versions[NANO_FLAVOUR] = version;
              },
            },
            [TYPEORM_FLAVOUR]: {
              retrieveLastVersion: async () => versions[TYPEORM_FLAVOUR],
              setCurrentVersion: async (version) => {
                versions[TYPEORM_FLAVOUR] = version;
              },
            },
          },
        } as any
      );

      const queued = await taskService.select().execute();
      const migrationTasks = queued.filter(
        (task) => task.classification === "migration-composite"
      );
      expect(migrationTasks).toHaveLength(4);
      const dependentTasks = migrationTasks.filter(
        (task) => (task.dependencies || []).length > 0
      );
      expect(dependentTasks).toHaveLength(2);

      for (const service of services) {
        await expect(service.track()).rejects.toThrow("intentional failure");
        await service.retry();
        await service.track();
      }

      expect(versions[NANO_FLAVOUR]).toBe("1.0.2");
      expect(versions[TYPEORM_FLAVOUR]).toBe("1.0.2");

      const nanoDoc = await nano.client.get(`${NANO_TABLE}__p-1`);
      expect((nanoDoc as any).category).toBe("dairy");
      expect((nanoDoc as any).stage).toBe("stable");

      const typeormRows = await typeorm.client.query(
        `SELECT "modelType", "stage" FROM "${TYPEORM_TABLE}" WHERE id = $1`,
        ["r1"]
      );
      expect(typeormRows[0].modelType).toBe("llm");
      expect(typeormRows[0].stage).toBe("stable");
    } finally {
      await taskService.shutdown().catch(() => undefined);
      await taskAdapter.shutdown().catch(() => undefined);
      await typeorm.shutdown().catch(() => undefined);
      await nano.shutdown().catch(() => undefined);
      await cleanupTypeORMTestResources(typeormResources);
      await cleanupNanoTestResources(nanoResources);
    }
  });
});
