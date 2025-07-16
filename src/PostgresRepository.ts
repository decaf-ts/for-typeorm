import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { repository, Repository } from "@decaf-ts/core";
import {
  Context,
  enforceDBDecorators,
  OperationKeys,
  ValidationError,
} from "@decaf-ts/db-decorators";
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
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
      this.pk as string,
      ...args
    );
    return this.adapter.revert<M>(m, this.class, this.pk, id);
  }

  protected override async createAllPrefix(models: M[], ...args: any[]) {
    const contextArgs = await Context.args(
      OperationKeys.CREATE,
      this.class,
      args,
      this.adapter,
      this._overrides || {}
    );
    if (!models.length) return [models, ...contextArgs.args];

    models = await Promise.all(
      models.map(async (m) => {
        m = new this.class(m);
        await enforceDBDecorators(
          this,
          contextArgs.context,
          m,
          OperationKeys.CREATE,
          OperationKeys.ON
        );
        return m;
      })
    );
    const errors = models
      .map((m) =>
        m.hasErrors(
          ...(contextArgs.context.get("ignoredValidationProperties") || [])
        )
      )
      .reduce((accum: string | undefined, e, i) => {
        if (e)
          accum =
            typeof accum === "string"
              ? accum + `\n - ${i}: ${e.toString()}`
              : ` - ${i}: ${e.toString()}`;
        return accum;
      }, undefined);
    if (errors) throw new ValidationError(errors);
    return [models, ...contextArgs.args];
  }

  override async createAll(models: M[], ...args: any[]): Promise<M[]> {
    if (!models.length) return models;
    const prepared = models.map((m) => this.adapter.prepare(m, this.pk));
    const ids = prepared.map((p) => p.id);
    let records = prepared.map((p) => p.record);
    records = await this.adapter.createAll(
      this.tableName,
      ids as (string | number)[],
      records,
      ...args
    );
    return records.map((r, i) =>
      this.adapter.revert(r, this.class, this.pk, ids[i] as string | number)
    );
  }

  override async readAll(
    keys: string[] | number[],
    ...args: any[]
  ): Promise<M[]> {
    const records = await this.adapter.readAll(
      this.tableName,
      keys,
      this.pk as string,
      ...args
    );
    return records.map((r, i) =>
      this.adapter.revert(r, this.class, this.pk, keys[i])
    );
  }

  override async updateAll(models: M[], ...args: any[]): Promise<M[]> {
    const records = models.map((m) => this.adapter.prepare(m, this.pk));
    const updated = await this.adapter.updateAll(
      this.tableName,
      records.map((r) => r.id),
      records.map((r) => r.record),
      this.pk as string,
      ...args
    );
    return updated.map((u, i) =>
      this.adapter.revert(u, this.class, this.pk, records[i].id)
    );
  }

  override async deleteAll(
    keys: string[] | number[],
    ...args: any[]
  ): Promise<M[]> {
    const results = await this.adapter.deleteAll(
      this.tableName,
      keys,
      this.pk as string,
      ...args
    );
    return results.map((r, i) =>
      this.adapter.revert(r, this.class, this.pk, keys[i])
    );
  }
}
