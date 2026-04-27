import { Adapter } from "@decaf-ts/core";
import { AbsMigration, migration, MigrationService } from "@decaf-ts/core/migrations";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { NanoAdapter } from "@decaf-ts/for-nano";
import { TypeORMAdapter } from "../../src";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";

const TEST_FLAVOUR = "typeorm-live-migration-add-property";
const TABLE = "for_typeorm_migration_prompts";
const NANO_FLAVOUR = "nano-live-migration-add-property";
const NANO_TABLE = "for_typeorm_migration_docs";
const NANO_DOC_ID = `${NANO_TABLE}__legacy`;
const TARGET_VERSION = "2.0.0";

const adminUser = process.env.TYPEORM_ADMIN_USER || "alfred";
const adminPassword = process.env.TYPEORM_ADMIN_PASSWORD || "password";
const adminDatabase = process.env.TYPEORM_ADMIN_DATABASE || "alfred";
const host = process.env.TYPEORM_HOST || "localhost";
const port = Number(process.env.TYPEORM_PORT || "5432");
const cleanupDelayMs = Number(process.env.TYPEORM_CLEANUP_DELAY_MS || "250");
const nanoAdminUser = process.env.NANO_ADMIN_USER || "couchdb.admin";
const nanoAdminPassword = process.env.NANO_ADMIN_PASSWORD || "couchdb.admin";
const nanoHost = process.env.NANO_HOST || "localhost:10010";
const nanoProtocol = (process.env.NANO_PROTOCOL as "http" | "https") || "http";
const nanoCleanupDelayMs = Number(process.env.NANO_CLEANUP_DELAY_MS || "250");

const adminConfig: DataSourceOptions = {
  type: "postgres",
  username: adminUser,
  password: adminPassword,
  database: adminDatabase,
  host,
  port,
};

function randomSuffix() {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function waitForCleanup(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
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
    await TypeORMAdapter.deleteDatabase(adminConnection, resources.dbName, resources.user);
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

async function createNanoTestResources(prefix: string) {
  const suffix = randomSuffix();
  const dbName = `${prefix}_${suffix}`;
  const user = `${prefix}_user_${suffix}`;
  const password = `${user}_pw`;
  const connection = NanoAdapter.connect(nanoAdminUser, nanoAdminPassword, nanoHost, nanoProtocol);
  await NanoAdapter.createDatabase(connection, dbName).catch((e: any) => {
    if (!(e instanceof ConflictError)) throw e;
  });
  await NanoAdapter.createUser(connection, dbName, user, password).catch((e: any) => {
    if (!(e instanceof ConflictError)) throw e;
  });
  return { connection, dbName, user, password, host: nanoHost, protocol: nanoProtocol };
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
    await NanoAdapter.deleteUser(resources.connection, resources.dbName, resources.user);
  } catch (e: any) {
    if (!(e instanceof NotFoundError)) throw e;
  } finally {
    NanoAdapter.closeConnection(resources.connection);
  }
  await waitForCleanup(nanoCleanupDelayMs);
}

class LiveTypeormAdapter extends TypeORMAdapter {
  constructor(conf: any, alias?: string) {
    super(conf, alias);
    (this as any).flavour = TEST_FLAVOUR;
    (Adapter as any)._cache[TEST_FLAVOUR] = this;
  }
}

class LiveNanoAdapter extends NanoAdapter {
  constructor(conf: any, alias?: string) {
    super(conf, alias);
    (this as any).flavour = NANO_FLAVOUR;
    (Adapter as any)._cache[NANO_FLAVOUR] = this;
  }
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

@migration("1.1.0-for-typeorm-live-add-model-type", "1.1.0", TEST_FLAVOUR)
class AddModelTypeMigration extends AbsMigration<any> {
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
    await addAndBackfillNonNullColumn(qr, TABLE, "modelType", "llm");
  }
}

void AddModelTypeMigration;

@migration(`${TARGET_VERSION}-for-typeorm-live-remove-obsolete`, TARGET_VERSION, TEST_FLAVOUR)
class RemoveObsoleteMigration extends AbsMigration<any> {
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
    await qr.query(`ALTER TABLE "${TABLE}" DROP COLUMN "obsolete"`);
  }
}

void RemoveObsoleteMigration;

@migration("1.0.1-for-nano-live-add-required-category", "1.0.1", NANO_FLAVOUR)
class NanoAddRequiredCategoryMigration extends AbsMigration<NanoAdapter> {
  protected getQueryRunner(conn: NanoAdapter): NanoAdapter {
    return conn;
  }

  async up(): Promise<void> {
    return;
  }

  async down(): Promise<void> {
    return;
  }

  async migrate(qr: NanoAdapter): Promise<void> {
    const all = await qr.list({ include_docs: true });
    const docs = (all.rows || [])
      .map((row: any) => row.doc)
      .filter((doc: any) => doc && typeof doc._id === "string")
      .filter((doc: any) => doc._id.startsWith(`${NANO_TABLE}__`))
      .map((doc: any) => ({
        ...doc,
        schemaVersion: TARGET_VERSION,
        requiredCategory: doc.requiredCategory || "core",
      }));

    if (docs.length) await qr.bulk({ docs });
  }
}

void NanoAddRequiredCategoryMigration;

describe("for-typeorm migration data evolution", () => {
  it("applies add/remove property migrations against live Postgres and Nano adapters", async () => {
    const nanoResources = await createNanoTestResources("for_typeorm_migration_add_prop");
    const typeormResources = await createTypeORMTestResources("for_typeorm_migration_add_prop");

    const nanoAdapter = new LiveNanoAdapter(
      {
        user: nanoResources.user,
        password: nanoResources.password,
        host: nanoResources.host,
        dbName: nanoResources.dbName,
        protocol: nanoResources.protocol,
      },
      NANO_FLAVOUR
    );

    const adapter = new LiveTypeormAdapter(
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
      TEST_FLAVOUR
    );

    const versions: Record<string, string> = {
      [TEST_FLAVOUR]: "1.0.0",
      [NANO_FLAVOUR]: "1.0.0",
    };

    try {
      await nanoAdapter.initialize();
      await adapter.initialize();

      await nanoAdapter.client.bulk({
        docs: [
          {
            _id: NANO_DOC_ID,
            id: "legacy-1",
            name: "legacy-doc",
          },
        ],
      });

      await adapter.client.query(
        `CREATE TABLE "${TABLE}" ("id" character varying PRIMARY KEY, "name" character varying NOT NULL, "obsolete" character varying)`
      );
      await adapter.client.query(
        `INSERT INTO "${TABLE}" ("id", "name", "obsolete") VALUES ($1, $2, $3)`,
        ["r1", "draft", "to-remove"]
      );

      await MigrationService.migrateAdapters(
        [nanoAdapter as any, adapter as any],
        {
          toVersion: TARGET_VERSION,
          handlers: {
            [NANO_FLAVOUR]: {
              retrieveLastVersion: async () => versions[NANO_FLAVOUR],
              setCurrentVersion: async (version) => {
                versions[NANO_FLAVOUR] = version;
              },
            },
            [TEST_FLAVOUR]: {
              retrieveLastVersion: async () => versions[TEST_FLAVOUR],
              setCurrentVersion: async (version) => {
                versions[TEST_FLAVOUR] = version;
              },
            },
          },
        } as any
      );

      const rows = await adapter.client.query(
        `SELECT id, name, "modelType" FROM "${TABLE}" WHERE id = $1`,
        ["r1"]
      );
      expect(rows[0].modelType).toBe("llm");

      const obsoleteColumn = await adapter.client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = '${TABLE}' AND column_name = 'obsolete'`
      );
      const modelTypeColumn = await adapter.client.query(
        `SELECT is_nullable FROM information_schema.columns WHERE table_name = '${TABLE}' AND column_name = 'modelType'`
      );

      expect(obsoleteColumn).toHaveLength(0);
      expect(modelTypeColumn[0].is_nullable).toBe("NO");

      const nanoDoc = await nanoAdapter.client.get(NANO_DOC_ID);
      expect((nanoDoc as any).requiredCategory).toBe("core");
      expect((nanoDoc as any).schemaVersion).toBe(TARGET_VERSION);

      expect(versions[TEST_FLAVOUR]).toBe(TARGET_VERSION);
      expect(versions[NANO_FLAVOUR]).toBe(TARGET_VERSION);
    } finally {
      await nanoAdapter.shutdown().catch(() => undefined);
      await adapter.shutdown().catch(() => undefined);
      await cleanupTypeORMTestResources(typeormResources);
      await cleanupNanoTestResources(nanoResources);
    }
  });
});
