/**
 * @module for-typeorm/tests/integration/typeorm-context-lock-session-binding
 * @summary Live-Postgres assurance that `TypeORMContextLock` drives the generic
 * `sessionBinding` seam transaction-locally.
 * @description Drives the real `TypeORMAdapter` and `TypeORMContextLock` against
 * a throwaway Postgres database whose runtime connection is a `NOSUPERUSER
 * NOBYPASSRLS` application role. A single-connection pool (`extra: { max: 1 }`)
 * makes Postgres session reuse real, so the transaction-local setting is proved
 * on the exact backend that served the model read and then proved to be gone
 * from the reused connection after commit.
 *
 * Everything here is deliberately domain-agnostic: a generic setting name
 * (`app.session_scope`) and a generic context key (`sessionScope`) are wired
 * only through the adapter's `sessionBinding` option. No application-specific
 * setting name, context key, resolver method, subclass, or method override is
 * involved -- the adapter is constructed as a plain `TypeORMAdapter`.
 *
 * The test model maps to a view that exposes `pg_backend_pid()` and
 * `current_setting('app.session_scope', true)` next to the row columns, so the
 * value reported by the model read is the value bound on the session that
 * actually served that read, not a value captured on another connection.
 *
 * The suite also records every query emitted through the real TypeORM driver
 * via a Logger, so the default (no `sessionBinding`) path can be shown to issue
 * zero `set_config` statements rather than merely leaving the setting unset.
 */
import { afterAll, beforeAll, describe, expect, it } from "@jest/globals";
import pg from "pg";
import { Adapter, Context, Repository } from "@decaf-ts/core";
import { column, pk, table, transactional } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import {
  Model,
  model,
  ModelArg,
  required,
} from "@decaf-ts/decorator-validation";
import { Logger } from "typeorm";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { TypeORMContextLock } from "../../src/TypeORMContextLock";
import { TypeORMRepository } from "../../src/TypeORMRepository";

jest.setTimeout(120_000);

const PG_HOST =
  process.env["DECAF_PG_HOST"] || process.env["SAA1032_PG_HOST"] || "127.0.0.1";
const PG_PORT = process.env["DECAF_PG_PORT"] || "55435";
const BASE_PG_URL =
  process.env["DECAF_PG_URL"] ||
  `postgresql://decaf:decaf-integration@${PG_HOST}:${PG_PORT}/decaf_integration`;

const RUN_TAG = `${process.pid}_${Date.now().toString(36)}`;
const DATABASE_NAME = `saa1162_scope_${RUN_TAG}`.toLowerCase();
const APP_ROLE = `saa1162_app_${RUN_TAG}`.toLowerCase();
const APP_PASSWORD = "saa1162-app-password";

const SETTING_NAME = "app.session_scope";
const CONTEXT_KEY = "sessionScope";
const SCOPE_VALUE = "graph-scope-alpha";
const PADDED_SCOPE_VALUE = `   ${SCOPE_VALUE}   `;

const PROBE_TABLE = "saa1162_scope_probe";
const PROBE_VIEW = "saa1162_scope_probe_v";
const PROBE_ID = "10000000-0000-4000-8000-0000000000a1";

@uses(TypeORMFlavour)
@table(PROBE_VIEW)
@model()
class SessionScopeProbeModel extends Model {
  @pk({ type: String })
  id!: string;

  @column()
  @required()
  name!: string;

  @column("backend_pid")
  backendPid!: number;

  @column("session_scope")
  sessionScope!: string;

  constructor(arg?: ModelArg<SessionScopeProbeModel>) {
    super(arg);
  }
}

const PROBE_SQL = `SELECT current_setting($1, true) AS session_scope,
                          pg_backend_pid() AS pid,
                          current_user AS role_name`;

function contextFrom(args: any[]): Context {
  const contexts = args.filter(
    (arg) => arg && typeof arg.getOrUndefined === "function"
  ) as Context[];
  if (!contexts.length)
    throw new Error("the @transactional call did not receive a Context");
  // `@transactional` appends the context it cached the lock on after any
  // caller-supplied context, so prefer the one that actually carries the lock.
  return (
    [...contexts]
      .reverse()
      .find((ctx) => ctx.getOrUndefined("transactionLock")) ??
    contexts[contexts.length - 1]
  );
}

function activeLock(ctx: Context): TypeORMContextLock<TypeORMAdapter> {
  const lock = ctx.getOrUndefined("transactionLock") as
    | TypeORMContextLock<TypeORMAdapter>
    | undefined;
  if (!lock || typeof lock.manager !== "function")
    throw new Error("no active TypeORMContextLock on the context");
  return lock;
}

function managerFor(ctx: Context) {
  const manager = activeLock(ctx).manager();
  if (!manager) throw new Error("the TypeORM transaction has no EntityManager");
  return manager;
}

interface ProbeRow {
  session_scope: string | null;
  pid: number;
  role_name: string;
}

class SessionScopeProbeRepository extends TypeORMRepository<SessionScopeProbeModel> {
  constructor(adapter: TypeORMAdapter) {
    super(adapter, SessionScopeProbeModel);
  }

  @transactional()
  async readWithScope(id: string, ...args: any[]): Promise<{
    before: ProbeRow;
    after: ProbeRow;
    model: SessionScopeProbeModel;
  }> {
    const ctx = contextFrom(args);
    const manager = managerFor(ctx);
    const before = await manager.query(PROBE_SQL, [SETTING_NAME]);
    const model = await this.read(id, ...args);
    const after = await manager.query(PROBE_SQL, [SETTING_NAME]);
    return {
      before: before[0] as ProbeRow,
      after: after[0] as ProbeRow,
      model,
    };
  }

  @transactional()
  async probeOnly(...args: any[]): Promise<ProbeRow> {
    const ctx = contextFrom(args);
    const manager = managerFor(ctx);
    const result = await manager.query(PROBE_SQL, [SETTING_NAME]);
    return result[0] as ProbeRow;
  }
}

interface RecordedQuery {
  query: string;
  parameters?: any[];
}

interface QueryRecorder {
  queries: RecordedQuery[];
  logger: Logger;
  reset(): void;
  setConfigCount(): number;
}

function createQueryRecorder(): QueryRecorder {
  const queries: RecordedQuery[] = [];
  const logger: Logger = {
    logQuery(query: string, parameters?: any[]) {
      queries.push({ query, parameters });
    },
    logQueryError() {
      /* not recorded; assertions fail on the thrown error instead */
    },
    logQuerySlow() {
      /* timing is not part of this contract */
    },
    logSchemaBuild() {
      /* schema logging is not part of this contract */
    },
    logMigration() {
      /* migrations are not part of this contract */
    },
    log() {
      /* generic log lines are not part of this contract */
    },
  };
  return {
    queries,
    logger,
    reset() {
      queries.length = 0;
    },
    setConfigCount() {
      return queries.filter((entry) => /set_config/i.test(entry.query)).length;
    },
  };
}

function urlForDatabase(database: string): string {
  const url = new URL(BASE_PG_URL);
  url.pathname = `/${database}`;
  return url.toString();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

function isUnbound(value: string | null | undefined): boolean {
  return value === null || value === undefined || value === "";
}

let adminClient: pg.Client | undefined;
let adminConnected = false;
let setupClient: pg.Client | undefined;
let scopeRecorder: QueryRecorder;
let defaultRecorder: QueryRecorder;
let emptyRecorder: QueryRecorder;
const emptyResolverCalls: Array<Context | undefined> = [];

async function buildAdapter(
  recorder: QueryRecorder,
  sessionBinding?: (context?: Context) => Record<string, string> | undefined
): Promise<TypeORMAdapter> {
  const base = new URL(BASE_PG_URL);
  const options: any = {
    type: "postgres",
    host: base.hostname,
    port: Number(base.port || 5432),
    username: APP_ROLE,
    password: APP_PASSWORD,
    database: DATABASE_NAME,
    synchronize: false,
    logging: ["query"],
    logger: recorder.logger,
    extra: { max: 1 },
  };
  if (sessionBinding) options.sessionBinding = sessionBinding;
  const created = new TypeORMAdapter(options);
  await created.initialize();
  return created;
}

/**
 * Builds one adapter/repository pair for a single case, then tears it down and
 * unregisters the alias so the next case can start from a clean adapter cache.
 * Each adapter keeps `extra: { max: 1 }`, so the single-backend assertions stay
 * real.
 */
async function withRepository<T>(
  recorder: QueryRecorder,
  sessionBinding:
    | ((context?: Context) => Record<string, string> | undefined)
    | undefined,
  run: (
    repo: SessionScopeProbeRepository,
    adapter: TypeORMAdapter
  ) => Promise<T>
): Promise<T> {
  const adapter = await buildAdapter(recorder, sessionBinding);
  try {
    return await run(new SessionScopeProbeRepository(adapter), adapter);
  } finally {
    await adapter.shutdown().catch(() => undefined);
    Adapter.unregister(adapter.alias);
    // Repository instances are cached per table+alias; each case builds a fresh
    // adapter/repository pair, so drop the prior instance to avoid a stale
    // cache hit on the next case.
    (Repository as any)._cache = {};
  }
}

beforeAll(async () => {
  adminClient = new pg.Client({
    connectionString: BASE_PG_URL,
    connectionTimeoutMillis: 5_000,
  });
  try {
    await adminClient.connect();
    adminConnected = true;
  } catch (error) {
    throw new Error(
      `Postgres is unreachable at ${BASE_PG_URL}; start the integrations harness ` +
        `(decaf-postgres-integration on port 55435) or set DECAF_PG_URL. ${(error as Error).message}`
    );
  }

  await adminClient.query(
    `DROP DATABASE IF EXISTS ${quoteIdentifier(DATABASE_NAME)} WITH (FORCE)`
  );
  await adminClient.query(`DROP ROLE IF EXISTS ${quoteIdentifier(APP_ROLE)}`);
  await adminClient.query(`CREATE DATABASE ${quoteIdentifier(DATABASE_NAME)}`);
  await adminClient.query(
    `CREATE ROLE ${quoteIdentifier(APP_ROLE)} LOGIN PASSWORD '${APP_PASSWORD}' NOSUPERUSER NOBYPASSRLS`
  );

  setupClient = new pg.Client({
    connectionString: urlForDatabase(DATABASE_NAME),
    connectionTimeoutMillis: 5_000,
  });
  await setupClient.connect();

  await setupClient.query(`
    CREATE TABLE ${PROBE_TABLE} (
      id uuid PRIMARY KEY,
      name text NOT NULL
    );
    INSERT INTO ${PROBE_TABLE} (id, name) VALUES ('${PROBE_ID}', 'scope-bound read');
    CREATE VIEW ${PROBE_VIEW} AS
      SELECT id,
             name,
             pg_backend_pid() AS backend_pid,
             current_setting('${SETTING_NAME}', true) AS session_scope
      FROM ${PROBE_TABLE};
    GRANT USAGE ON SCHEMA public TO ${quoteIdentifier(APP_ROLE)};
    GRANT SELECT ON ${PROBE_TABLE}, ${PROBE_VIEW} TO ${quoteIdentifier(APP_ROLE)};
  `);

  scopeRecorder = createQueryRecorder();
  defaultRecorder = createQueryRecorder();
  emptyRecorder = createQueryRecorder();
});

afterAll(async () => {
  if (setupClient) {
    await setupClient.end().catch(() => undefined);
    setupClient = undefined;
  }
  if (adminClient && adminConnected) {
    await adminClient
      .query(
        `DROP DATABASE IF EXISTS ${quoteIdentifier(DATABASE_NAME)} WITH (FORCE)`
      )
      .catch(() => undefined);
    await adminClient
      .query(`DROP ROLE IF EXISTS ${quoteIdentifier(APP_ROLE)}`)
      .catch(() => undefined);
    await adminClient.end().catch(() => undefined);
    adminClient = undefined;
  }
});

function scopeContext(value: string = PADDED_SCOPE_VALUE): Context {
  return (new Context() as any).accumulate({
    [CONTEXT_KEY]: value,
    operation: "graph.resolve",
  }) as Context;
}

const scopeBinding = (context?: Context): Record<string, string> | undefined => {
  const value = context?.getOrUndefined(CONTEXT_KEY as any);
  return typeof value === "string" ? { [SETTING_NAME]: value } : undefined;
};

describe("TypeORMContextLock transaction-local session binding", () => {
  it("binds the ctx value on the same backend that serves the model read", async () => {
    scopeRecorder.reset();
    const result = await withRepository(scopeRecorder, scopeBinding, (repo) =>
      repo.readWithScope(PROBE_ID, scopeContext())
    );

    // The view's `pg_backend_pid()` proves the probe, the model read and the
    // transaction manager all served the read from one Postgres session.
    expect(result.before.pid).toBe(result.model.backendPid);
    expect(result.after.pid).toBe(result.before.pid);
    expect(result.before.session_scope).toBe(SCOPE_VALUE);
    expect(result.after.session_scope).toBe(SCOPE_VALUE);
    expect(result.model.sessionScope).toBe(SCOPE_VALUE);
  });

  it("binds the exact ctx value, trimmed", async () => {
    const result = await withRepository(scopeRecorder, scopeBinding, (repo) =>
      repo.readWithScope(PROBE_ID, scopeContext(`  ${SCOPE_VALUE}-trimmed  `))
    );
    expect(result.before.session_scope).toBe(`${SCOPE_VALUE}-trimmed`);
    expect(result.model.sessionScope).toBe(`${SCOPE_VALUE}-trimmed`);
    expect(result.before.session_scope).not.toContain(" ");
  });

  it("issues exactly one transaction-local set_config for a single setting", async () => {
    scopeRecorder.reset();
    await withRepository(scopeRecorder, scopeBinding, (repo) =>
      repo.readWithScope(PROBE_ID, scopeContext())
    );
    const statements = scopeRecorder.queries.filter((entry) =>
      /set_config/i.test(entry.query)
    );
    expect(statements).toHaveLength(1);
    expect(statements[0].query).toContain("set_config");
    expect(statements[0].parameters).toEqual([SETTING_NAME, SCOPE_VALUE]);
  });

  it("leaves no setting on the reused single-connection pool after commit", async () => {
    scopeRecorder.reset();
    const { first, second } = await withRepository(
      scopeRecorder,
      scopeBinding,
      async (repo) => {
        const bound = await repo.readWithScope(PROBE_ID, scopeContext());
        // Observe a transaction that carries NO value so the check detects
        // residue from the committed bound transaction instead of re-binding
        // by design.
        const unbound = await repo.probeOnly();
        return { first: bound, second: unbound };
      }
    );
    expect(first.before.session_scope).toBe(SCOPE_VALUE);
    expect(second.pid).toBe(first.before.pid);
    expect(isUnbound(second.session_scope)).toBe(true);
    expect(scopeRecorder.setConfigCount()).toBe(1);
  });

  it("default path with no sessionBinding issues zero statements and leaves the setting unbound", async () => {
    defaultRecorder.reset();
    const result = await withRepository(defaultRecorder, undefined, (repo) =>
      repo.readWithScope(PROBE_ID, scopeContext())
    );
    expect(result.before.pid).toBe(result.model.backendPid);
    expect(isUnbound(result.before.session_scope)).toBe(true);
    expect(isUnbound(result.after.session_scope)).toBe(true);
    expect(isUnbound(result.model.sessionScope)).toBe(true);
    expect(defaultRecorder.setConfigCount()).toBe(0);
  });

  it("needs config-only injection: no adapter subclass or method override", async () => {
    await withRepository(scopeRecorder, scopeBinding, async (_repo, adapter) => {
      expect(Object.getPrototypeOf(adapter)).toBe(TypeORMAdapter.prototype);
      expect(
        Object.prototype.hasOwnProperty.call(
          adapter,
          "sessionSettingsForContext"
        )
      ).toBe(false);
      // The option is consumed by the adapter constructor and never reaches
      // the underlying DataSource.
      expect((adapter as any).config.sessionBinding).toBeUndefined();
      expect((adapter.client.options as any).sessionBinding).toBeUndefined();
      expect(
        adapter.sessionSettingsForContext(scopeContext(PADDED_SCOPE_VALUE))
      ).toEqual({ [SETTING_NAME]: SCOPE_VALUE });
    });
  });

  it("a resolver returning nothing binds nothing", async () => {
    emptyResolverCalls.length = 0;
    emptyRecorder.reset();
    const result = await withRepository(emptyRecorder, (context) => {
      emptyResolverCalls.push(context);
      return undefined;
    }, (repo) => repo.readWithScope(PROBE_ID, scopeContext()));
    expect(emptyResolverCalls.length).toBeGreaterThan(0);
    expect(isUnbound(result.before.session_scope)).toBe(true);
    expect(isUnbound(result.after.session_scope)).toBe(true);
    expect(isUnbound(result.model.sessionScope)).toBe(true);
    expect(emptyRecorder.setConfigCount()).toBe(0);
  });

  it("runs on the NOSUPERUSER NOBYPASSRLS application role", async () => {
    await withRepository(scopeRecorder, scopeBinding, async (_repo, adapter) => {
      const result = await adapter.client.query(
        `SELECT current_user AS role_name, r.rolsuper, r.rolbypassrls
           FROM pg_roles r
          WHERE r.rolname = current_user`
      );
      expect(result[0]).toEqual({
        role_name: APP_ROLE,
        rolsuper: false,
        rolbypassrls: false,
      });
    });
  });
});
