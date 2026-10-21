/**
 * @module for-typeorm/tests/unit/typeorm-context-lock-driver-gating
 * @summary Verifies the driver gate in `TypeORMContextLock.begin`: the generic
 * `sessionBinding` resolver is only consulted, and `set_config` only issued,
 * for the Postgres driver.
 * @description The only TypeORM driver installed in this package is `pg`, so a
 * live non-Postgres transaction cannot be opened here. This unit test drives
 * the real adapter (real `detectTypeORMDriver`, real
 * `sessionSettingsForContext`) against a fake `QueryRunner` to prove the
 * structural guarantee directly: a non-Postgres driver never reaches the
 * binding branch, while the Postgres branch issues one transaction-local
 * `set_config` per resolved setting.
 */
import { Context } from "@decaf-ts/core";
import { TypeORMAdapter } from "../../src";
import { TypeORMContextLock } from "../../src/TypeORMContextLock";
import { TypeORMDriver } from "../../src/types";

const SETTING_NAME = "app.session_scope";
const CONTEXT_KEY = "sessionScope";
const SCOPE_VALUE = "driver-gate-scope";

interface QueryCall {
  sql: string;
  parameters?: any[];
}

function fakeQueryRunner() {
  const calls: QueryCall[] = [];
  const runner = {
    calls,
    connect: jest.fn(async () => undefined),
    startTransaction: jest.fn(async () => undefined),
    commitTransaction: jest.fn(async () => undefined),
    rollbackTransaction: jest.fn(async () => undefined),
    release: jest.fn(async () => undefined),
    query: jest.fn(async (sql: string, parameters?: any[]) => {
      calls.push({ sql, parameters });
      return [];
    }),
    manager: {},
  };
  return runner;
}

function adapterWithRunner(
  type: string,
  resolver: jest.Mock,
  alias: string
) {
  const adapter = new TypeORMAdapter(
    { type, sessionBinding: resolver } as any,
    alias
  );
  const runner = fakeQueryRunner();
  (adapter as any)._client = {
    isInitialized: true,
    createQueryRunner: () => runner,
  };
  return { adapter, runner };
}

function contextWithScope(): Context {
  return (new Context() as any).accumulate({
    [CONTEXT_KEY]: SCOPE_VALUE,
  }) as Context;
}

describe("TypeORMContextLock session binding driver gate", () => {
  it("never consults the resolver or issues set_config for a non-Postgres driver", async () => {
    const resolver = jest.fn(() => ({ [SETTING_NAME]: SCOPE_VALUE }));
    const { adapter, runner } = adapterWithRunner(
      TypeORMDriver.SQLITE,
      resolver,
      "unit-gate-sqlite"
    );

    expect(adapter.driver).toBe(TypeORMDriver.SQLITE);

    const lock = new TypeORMContextLock(adapter);
    await lock.begin(contextWithScope());

    expect(resolver).not.toHaveBeenCalled();
    expect(runner.query).not.toHaveBeenCalled();
    expect(runner.calls).toHaveLength(0);

    await lock.rollback();
  });

  it("issues one transaction-local set_config per resolved setting on Postgres", async () => {
    const resolver = jest.fn(() => ({
      [SETTING_NAME]: SCOPE_VALUE,
      "app.session_region": " eu-west ",
    }));
    const { adapter, runner } = adapterWithRunner(
      TypeORMDriver.POSTGRES,
      resolver,
      "unit-gate-postgres"
    );

    expect(adapter.driver).toBe(TypeORMDriver.POSTGRES);

    const lock = new TypeORMContextLock(adapter);
    await lock.begin(contextWithScope());

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(runner.calls).toEqual([
      {
        sql: "SELECT set_config($1, $2, true)",
        parameters: [SETTING_NAME, SCOPE_VALUE],
      },
      {
        sql: "SELECT set_config($1, $2, true)",
        parameters: ["app.session_region", "eu-west"],
      },
    ]);

    await lock.rollback();
  });

  it("issues no statement when a Postgres resolver returns nothing", async () => {
    const resolver = jest.fn(() => undefined);
    const { adapter, runner } = adapterWithRunner(
      TypeORMDriver.POSTGRES,
      resolver,
      "unit-gate-postgres-empty"
    );

    const lock = new TypeORMContextLock(adapter);
    await lock.begin(contextWithScope());

    expect(resolver).toHaveBeenCalledTimes(1);
    expect(runner.query).not.toHaveBeenCalled();

    await lock.rollback();
  });
});
