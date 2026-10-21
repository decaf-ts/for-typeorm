import { Context, ContextLock } from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";
import { EntityManager, QueryRunner } from "typeorm";
import { TypeORMDriver } from "./types";
import type { TypeORMAdapter, TypeORMContext } from "./TypeORMAdapter";

/**
 * @description Postgres-native transaction lock for the TypeORM adapter
 * @summary Backs `@transactional()` with a real TypeORM `QueryRunner`, issuing native
 * `BEGIN`/`COMMIT`/`ROLLBACK` statements. While a transaction is active, `TypeORMAdapter`'s
 * CRUD methods resolve repositories from this lock's transactional `EntityManager` instead of
 * the DataSource's default (pooled, non-transactional) connection, so every operation performed
 * under `@transactional()` - across however many nested calls - participates in the same
 * underlying Postgres transaction. `begin(context)` additionally binds
 * context-resolved session settings (see {@link TypeORMContextLock.begin}) transaction-locally.
 * @class TypeORMContextLock
 */
export class TypeORMContextLock<
  A extends TypeORMAdapter = TypeORMAdapter,
> extends ContextLock<A> {
  private queryRunner?: QueryRunner;

  /**
   * @description Opens the transaction and binds the context's session settings
   * @summary Starts a transaction on a fresh `QueryRunner` and, on Postgres
   * only, asks the adapter for the context's {@link TypeORMSessionSettings}
   * and issues one parameterized `SELECT set_config($1, $2, true)` per
   * resolved setting, so every value is transaction-local: Postgres discards
   * it at commit or rollback and it never leaks into pooled connections
   * reused by other requests. With no binding configured, a non-Postgres
   * driver, or a binding that resolves nothing, zero extra statements are
   * issued. On any failure the query runner is rolled back and released
   * before the error is rethrown, so no connection is leaked.
   * @param {Context<any>} [context] - The request context whose settings should be bound.
   * @returns {Promise<void>} Resolves once the transaction is open and any resolved settings are bound.
   * @throws {Error} Re-throws any error raised while connecting, starting the transaction, or binding the settings.
   */
  override async begin(context?: Context<any>): Promise<void> {
    const client = this.adapter.client;
    if (!client.isInitialized) await client.initialize();
    const queryRunner = client.createQueryRunner();
    try {
      await queryRunner.connect();
      await queryRunner.startTransaction();
      if (this.adapter.driver === TypeORMDriver.POSTGRES) {
        const settings = this.adapter.sessionSettingsForContext(
          context as TypeORMContext | undefined
        );
        if (settings)
          for (const [name, value] of Object.entries(settings))
            await queryRunner.query("SELECT set_config($1, $2, true)", [
              name,
              value,
            ]);
      }
    } catch (error: unknown) {
      await queryRunner.rollbackTransaction().catch(() => undefined);
      await queryRunner.release().catch(() => undefined);
      throw error;
    }
    this.queryRunner = queryRunner;
  }

  override async commit(): Promise<void> {
    if (!this.queryRunner)
      throw new InternalError("No active TypeORM transaction to commit");
    try {
      await this.queryRunner.commitTransaction();
    } finally {
      await this.queryRunner.release();
      this.queryRunner = undefined;
    }
  }

  override async rollback(): Promise<void> {
    if (!this.queryRunner) return;
    try {
      await this.queryRunner.rollbackTransaction();
    } finally {
      await this.queryRunner.release();
      this.queryRunner = undefined;
    }
  }

  /**
   * @description The transactional EntityManager, when a transaction is active
   */
  manager(): EntityManager | undefined {
    return this.queryRunner?.manager;
  }
}
