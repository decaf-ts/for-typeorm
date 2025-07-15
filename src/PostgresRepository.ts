import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { Repository } from "@decaf-ts/core";
import { Context } from "@decaf-ts/db-decorators";
import { PostgresAdapter } from "./adapter";
import { PostgresFlags, PostgresQuery } from "./types";

/**
 * @description Type for PostgreSQL database repositories
 * @summary A specialized repository type for working with PostgreSQL databases, extending the base Repository
 * with PostgreSQL-specific adapter, flags, and context types
 * @template M - Type extending Model that this repository will manage
 * @memberOf module:for-postgres
 */
export class PostgresRepository<M extends Model> extends Repository<
  M,
  PostgresQuery,
  PostgresAdapter,
  PostgresFlags,
  Context<PostgresFlags>
> {
  constructor(adapter: PostgresAdapter, model: Constructor<M>, ...args: any[]) {
    super(adapter, model, ...args);
  }

  /**
   * @description Reads a model from the database by ID.
   * @summary Retrieves a model instance from the database using its primary key.
   * @param {string|number|bigint} id - The primary key of the model to read.
   * @param {...any[]} args - Additional arguments.
   * @return {Promise<M>} The retrieved model instance.
   */
  override async read(
    id: string | number | bigint,
    ...args: any[]
  ): Promise<M> {
    const m = await this.adapter.read(
      this.tableName,
      id as string,
      this.pk as string
    );
    return this.adapter.revert<M>(m, this.class, this.pk, id);
  }

  /**
   * @description Deletes a model from the database by ID.
   * @summary Removes a model instance from the database using its primary key.
   * @param {string|number|bigint} id - The primary key of the model to delete.
   * @param {...any[]} args - Additional arguments.
   * @return {Promise<M>} The deleted model instance.
   */
  override async delete(
    id: string | number | bigint,
    ...args: any[]
  ): Promise<M> {
    const m = await this.adapter.delete(
      this.tableName,
      id as string,
      this.pk as string
    );
    return this.adapter.revert<M>(m, this.class, this.pk, id);
  }
}
