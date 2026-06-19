/**
 * @description Tests for simultaneous @transactional calls against live Postgres
 * @summary Verifies that two concurrent @transactional() calls each get their own
 * TypeORMContextLock (and therefore their own dedicated Postgres connection/transaction), and
 * that the resulting behavior matches native Postgres transaction semantics:
 * - an uncommitted insert is invisible to a separate connection until COMMIT (READ COMMITTED), and
 * - a concurrent UPDATE of the same row blocks on Postgres's row-level write lock until the first
 *   transaction ends, which is confirmed directly via `pg_stat_activity`, not just by timing.
 */
import { DataSource } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";
import { TypeORMAdapter, TypeORMFlavour } from "../../src";
import { TypeORMRepository } from "../../src/TypeORMRepository";
import { column, pk, table, transactional } from "@decaf-ts/core";
import { uses } from "@decaf-ts/decoration";
import { ConflictError, NotFoundError } from "@decaf-ts/db-decorators";
import { Model, model, ModelArg, required } from "@decaf-ts/decorator-validation";

jest.setTimeout(60000);

const admin = "alfred";
const admin_password = "password";
const user = "tx_concurrent_user";
const user_password = "password";
const dbName = "tx_concurrent_db";
const dbHost = "localhost";

const config: DataSourceOptions = {
  type: "postgres",
  username: admin,
  password: admin_password,
  database: "alfred",
  host: dbHost,
  port: 5432,
} as PostgresConnectionOptions;

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
@table("tst_tx_concurrent")
@model()
class ConcurrentTxModel extends Model {
  @pk()
  id!: string;

  @column()
  @required()
  name!: string;

  constructor(arg?: ModelArg<ConcurrentTxModel>) {
    super(arg);
  }
}

/**
 * @description Test-only knobs to pause a transaction mid-flight from outside
 * @summary Kept as plain instance fields - not method parameters - so they never enter the
 * positional argument list that `@transactional()`/`Adapter.context()` forwards into the
 * Context's flags cache (which would otherwise wait on these promises as if they were
 * domain call args).
 */
class ConcurrentTxRepository extends TypeORMRepository<ConcurrentTxModel> {
  onHeld?: () => void;
  gate?: Promise<void>;

  constructor(adapter: TypeORMAdapter, force = false) {
    super(adapter, ConcurrentTxModel, force);
  }

  @transactional()
  async createAndHold(
    toCreate: ConcurrentTxModel,
    ...args: any[]
  ): Promise<ConcurrentTxModel> {
    const created = await this.create(toCreate, ...args);
    this.onHeld?.();
    await this.gate;
    return created;
  }

  @transactional()
  async updateAndHold(
    toUpdate: ConcurrentTxModel,
    ...args: any[]
  ): Promise<ConcurrentTxModel> {
    const updated = await this.update(toUpdate, ...args);
    this.onHeld?.();
    await this.gate;
    return updated;
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs = 5000,
  intervalMs = 25
): Promise<void> {
  const start = Date.now();
  for (;;) {
    if (await predicate()) return;
    if (Date.now() - start > timeoutMs)
      throw new Error("waitFor: condition not met within timeout");
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

describe("simultaneous @transactional calls against live Postgres", () => {
  let con: DataSource | undefined;
  let adapter: TypeORMAdapter;
  let repo: ConcurrentTxRepository;
  let verifyCon: DataSource;

  beforeAll(async () => {
    con = await TypeORMAdapter.connect(config);
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
        Object.assign({}, config, { database: dbName })
      );
      await TypeORMAdapter.createUser(con, dbName, user, user_password);
      await TypeORMAdapter.createNotifyFunction(con, user);
      await con.destroy();
      con = undefined;
    } catch (e: unknown) {
      if (!(e instanceof ConflictError)) throw e;
    }

    adapter = new TypeORMAdapter(typeOrmCfg);
    await adapter.initialize();
    repo = new ConcurrentTxRepository(adapter);

    verifyCon = await TypeORMAdapter.connect(
      Object.assign({}, config, { database: dbName })
    );
  });

  afterAll(async () => {
    await verifyCon.destroy();
    if (con) await con.destroy();
    await adapter.shutdown();
    con = await TypeORMAdapter.connect(config);
    await TypeORMAdapter.deleteDatabase(con, dbName, user);
    await TypeORMAdapter.deleteUser(con, user, admin);
    await con.destroy();
  });

  it("hides an uncommitted insert from another connection until COMMIT", async () => {
    const held = deferred();
    const gate = deferred();
    repo.onHeld = held.resolve;
    repo.gate = gate.promise;

    const txPromise = repo.createAndHold(
      new ConcurrentTxModel({ id: "101", name: "hidden-until-commit" })
    );

    await held.promise;

    const beforeCommit = await verifyCon.query(
      `SELECT 1 FROM tst_tx_concurrent WHERE id = '101'`
    );
    expect(beforeCommit).toHaveLength(0);

    gate.resolve();
    const result = await txPromise;
    expect(result.name).toBe("hidden-until-commit");

    const afterCommit = await verifyCon.query(
      `SELECT name FROM tst_tx_concurrent WHERE id = '101'`
    );
    expect(afterCommit).toHaveLength(1);
    expect(afterCommit[0].name).toBe("hidden-until-commit");
  });

  it("blocks a concurrent UPDATE of the same row on Postgres's row lock until the first transaction ends", async () => {
    await repo.create(new ConcurrentTxModel({ id: "102", name: "initial" }));

    const repoA = new ConcurrentTxRepository(adapter, true);
    const repoB = new ConcurrentTxRepository(adapter, true);

    const updatedA = deferred();
    const gateA = deferred();
    const updatedB = deferred();
    const gateB = deferred();
    repoA.onHeld = updatedA.resolve;
    repoA.gate = gateA.promise;
    repoB.onHeld = updatedB.resolve;
    repoB.gate = gateB.promise;

    const txA = repoA.updateAndHold(
      new ConcurrentTxModel({ id: "102", name: "txn-a" })
    );
    await updatedA.promise; // txn A's UPDATE has executed and holds the row lock, uncommitted

    let bSettled = false;
    const txB = repoB
      .updateAndHold(new ConcurrentTxModel({ id: "102", name: "txn-b" }))
      .then((r) => {
        bSettled = true;
        return r;
      });

    // confirm, directly via Postgres, that txn B's UPDATE is genuinely blocked on a lock
    // held by another backend - not just "hasn't been scheduled yet"
    await waitFor(async () => {
      const waiters = await verifyCon.query(
        `SELECT count(*)::int AS n FROM pg_stat_activity
         WHERE datname = $1 AND wait_event_type = 'Lock' AND state = 'active'`,
        [dbName]
      );
      return waiters[0].n >= 1;
    });
    expect(bSettled).toBe(false);

    gateA.resolve();
    await txA;

    await updatedB.promise; // txn B's UPDATE was unblocked once txn A committed
    gateB.resolve();
    const resultB = await txB;
    expect(resultB.name).toBe("txn-b");

    const final = await verifyCon.query(
      `SELECT name FROM tst_tx_concurrent WHERE id = '102'`
    );
    expect(final[0].name).toBe("txn-b");
  });
});
