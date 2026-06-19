import { ContextLock } from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";
import { EntityManager, QueryRunner } from "typeorm";
import { TypeORMAdapter } from "./TypeORMAdapter";

/**
 * @description Postgres-native transaction lock for the TypeORM adapter
 * @summary Backs `@transactional()` with a real TypeORM `QueryRunner`, issuing native
 * `BEGIN`/`COMMIT`/`ROLLBACK` statements. While a transaction is active, `TypeORMAdapter`'s
 * CRUD methods resolve repositories from this lock's transactional `EntityManager` instead of
 * the DataSource's default (pooled, non-transactional) connection, so every operation performed
 * under `@transactional()` - across however many nested calls - participates in the same
 * underlying Postgres transaction.
 * @class TypeORMContextLock
 */
export class TypeORMContextLock<
  A extends TypeORMAdapter = TypeORMAdapter,
> extends ContextLock<A> {
  private queryRunner?: QueryRunner;

  override async begin(): Promise<void> {
    const client = this.adapter.client;
    if (!client.isInitialized) await client.initialize();
    const queryRunner = client.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
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
