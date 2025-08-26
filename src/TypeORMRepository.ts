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
 * @description Repository implementation backed by TypeORM.
 * @summary Provides CRUD operations for a given Model using the {@link TypeORMAdapter}, including bulk operations and query builder access while preserving Decaf.ts repository semantics.
 * @template M Type extending Model that this repository will manage.
 * @param {TypeORMAdapter} adapter The adapter used to execute persistence operations.
 * @param {Constructor<M>} model The Model constructor associated with this repository.
 * @param {...any[]} args Optional arguments forwarded to the base Repository.
 * @class TypeORMRepository
 * @example
 * // Creating a repository
 * const repo = new TypeORMRepository<User>(adapter, User);
 * const created = await repo.create(new User({ name: "Alice" }));
 * const read = await repo.read(created.id);
 *
 * // Bulk create
 * await repo.createAll([new User({ name: "A" }), new User({ name: "B" })]);
 *
 * // Using the query builder
 * const qb = repo.queryBuilder();
 * const rows = await qb.where("name = :name", { name: "Alice" }).getMany();
 *
 * @mermaid
 * sequenceDiagram
 *   participant App
 *   participant Repo as TypeORMRepository
 *   participant Adapter as TypeORMAdapter
 *   participant DB as TypeORM/DataSource
 *
 *   App->>Repo: create(model)
 *   Repo->>Adapter: prepare(model, pk)
 *   Adapter-->>Repo: { record, id, transient }
 *   Repo->>Adapter: create(table, id, model, ...args)
 *   Adapter->>DB: INSERT ...
 *   DB-->>Adapter: row
 *   Adapter-->>Repo: row
 *   Repo->>Adapter: revert(row, clazz, pk, id)
 *   Adapter-->>Repo: model
 *   Repo-->>App: model
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

  /**
   * @description Creates a TypeORM query builder for the repository entity.
   * @summary Returns a SelectQueryBuilder bound to this repository's entity for advanced querying.
   * @return {import("typeorm").SelectQueryBuilder<any>} A TypeORM SelectQueryBuilder instance.
   */
  queryBuilder() {
    const repo = this.adapter.dataSource.getRepository(
      this.class[ModelKeys.ANCHOR as keyof typeof this.class]
    );
    return repo.createQueryBuilder();
  }

  /**
   * @description Creates and persists a model instance.
   * @summary Prepares the model, delegates insertion to the adapter, and rehydrates the persisted state back into a Model instance.
   * @param {M} model The model to create.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M>} The created model instance.
   */
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

  /**
   * @description Updates and persists a model instance.
   * @summary Prepares the model, delegates update to the adapter, and rehydrates the persisted state back into a Model instance.
   * @param {M} model The model to update.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M>} The updated model instance.
   */
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

  /**
   * @description Validates and prepares models for bulk creation.
   * @summary Applies decorator-based validations and returns transformed models with context args for createAll.
   * @param {M[]} models The models to be created.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<[M[], ...any[]]>} The prepared models and forwarded args tuple.
   */
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

  /**
   * @description Creates multiple models at once.
   * @summary Prepares, persists, and rehydrates a batch of models.
   * @param {M[]} models The models to create.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M[]>} The created models.
   */
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

  /**
   * @description Reads multiple models by their primary keys.
   * @summary Retrieves a list of models corresponding to the provided keys.
   * @param {(string[]|number[])} keys The primary keys to read.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M[]>} The retrieved models.
   */
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

  /**
   * @description Updates multiple models at once.
   * @summary Persists a batch of model updates and returns their rehydrated instances.
   * @param {M[]} models The models to update.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M[]>} The updated models.
   */
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

  /**
   * @description Deletes multiple models at once.
   * @summary Removes a list of models by their primary keys and returns their last persisted states.
   * @param {(string[]|number[])} keys The primary keys to delete.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M[]>} The deleted models.
   */
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
