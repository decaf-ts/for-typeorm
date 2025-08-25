import {
  type Constructor,
  Model,
  ModelKeys,
} from "@decaf-ts/decorator-validation";
import { Repository, uses } from "@decaf-ts/core";
import {
  Context,
  enforceDBDecorators,
  OperationKeys,
  ValidationError,
} from "@decaf-ts/db-decorators";
import { TypeORMFlags, TypeORMQuery } from "./types";
import { TypeORMAdapter } from "./TypeORMAdapter";
import { TypeORMFlavour } from "./constants";

/**
 * @description Type for PostgreSQL database repositories
 * @summary A specialized repository type for working with PostgreSQL databases, extending the base Repository
 * with PostgreSQL-specific adapter, flags, and context types
 * @template M - Type extending Model that this repository will manage
 * @memberOf module:for-postgres
 */
@uses(TypeORMFlavour)
export class TypeORMRepository<M extends Model> extends Repository<
  M,
  TypeORMQuery<M, any>,
  TypeORMAdapter,
  TypeORMFlags,
  Context<TypeORMFlags>
> {
  constructor(adapter: TypeORMAdapter, model: Constructor<M>, ...args: any[]) {
    super(adapter, model, ...args);
  }

  queryBuilder() {
    const repo = this.adapter.dataSource.getRepository(
      this.class[ModelKeys.ANCHOR as keyof typeof this.class]
    );
    return repo.createQueryBuilder();
  }

  override async create(model: M, ...args: any[]): Promise<M> {
    // eslint-disable-next-line prefer-const
    let { record, id, transient } = this.adapter.prepare(model, this.pk);
    record = await this.adapter.create(
      (this.class as any)[ModelKeys.ANCHOR] as any,
      id,
      model as any,
      ...args
    );
    let c: Context<TypeORMFlags> | undefined = undefined;
    if (args.length) c = args[args.length - 1] as Context<TypeORMFlags>;
    return this.adapter.revert<M>(
      record,
      this.class,
      this.pk,
      id,
      c && c.get("rebuildWithTransient") ? transient : undefined
    );
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
      (this.class as any)[ModelKeys.ANCHOR] as any,
      id as string,
      this.pk as string
    );
    return this.adapter.revert<M>(m, this.class, this.pk, id);
  }

  override async update(model: M, ...args: any[]): Promise<M> {
    // eslint-disable-next-line prefer-const
    let { record, id, transient } = this.adapter.prepare(model, this.pk);
    record = await this.adapter.update(
      (this.class as any)[ModelKeys.ANCHOR] as any,
      id,
      model,
      ...args
    );
    return this.adapter.revert<M>(record, this.class, this.pk, id, transient);
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
      (this.class as any)[ModelKeys.ANCHOR] as any,
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
      (this.class as any)[ModelKeys.ANCHOR] as any,
      ids as (string | number)[],
      models,
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
      (this.class as any)[ModelKeys.ANCHOR] as any,
      keys,
      this.pk as string,
      ...args
    );
    return records.map((r: Record<string, any>, i: number) =>
      this.adapter.revert(r, this.class, this.pk, keys[i])
    );
  }

  override async updateAll(models: M[], ...args: any[]): Promise<M[]> {
    const records = models.map((m) => this.adapter.prepare(m, this.pk));
    const updated = await this.adapter.updateAll(
      (this.class as any)[ModelKeys.ANCHOR] as any,
      records.map((r) => r.id),
      models,
      this.pk as string,
      ...args
    );
    return updated.map((u: Record<string, any>, i: number) =>
      this.adapter.revert(u, this.class, this.pk, records[i].id)
    );
  }

  override async deleteAll(
    keys: string[] | number[],
    ...args: any[]
  ): Promise<M[]> {
    const results = await this.adapter.deleteAll(
      (this.class as any)[ModelKeys.ANCHOR] as any,
      keys,
      this.pk as string,
      ...args
    );
    return results.map((r: Record<string, any>, i: number) =>
      this.adapter.revert(r, this.class, this.pk, keys[i])
    );
  }
}
