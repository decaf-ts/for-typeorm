import { Model, ValidationKeys } from "@decaf-ts/decorator-validation";
import { Adapter, Repository } from "@decaf-ts/core";
import {
  Context,
  enforceDBDecorators,
  InternalError,
  IRepository,
  OperationKeys,
  RepositoryFlags,
  ValidationError,
} from "@decaf-ts/db-decorators";
import { TypeORMFlags, TypeORMQuery } from "./types";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { QueryBuilder, Repository as NativeRepo } from "typeorm";
import { type Constructor, Metadata } from "@decaf-ts/decoration";

export async function enforceDbDecoratorsRecursive<
  M extends Model<true | false>,
  R extends IRepository<M, F, C>,
  V extends object = object,
  F extends RepositoryFlags = RepositoryFlags,
  C extends Context<F> = Context<F>,
>(
  repo: R,
  context: C,
  model: M,
  operation: string,
  prefix: string,
  oldModel?: M
): Promise<void> {
  await enforceDBDecorators<M, R, V, F, C>(
    repo,
    context,
    model,
    operation,
    prefix,
    oldModel
  );

  async function innerLoop<N extends Model>(m: N, oldModel?: N) {
    const r = Repository.forModel(m.constructor as Constructor<N>);
    await enforceDbDecoratorsRecursive(
      r,
      context,
      m,
      !oldModel && operation === OperationKeys.UPDATE
        ? OperationKeys.CREATE
        : operation,
      prefix,
      oldModel
    );
  }

  for (const key of Object.keys(model)) {
    if (
      Model.isPropertyModel(model, key) &&
      typeof model[key as keyof typeof model] !== "undefined"
    ) {
      await innerLoop(
        model[key as keyof typeof model] as any,
        oldModel ? (oldModel[key as keyof typeof oldModel] as any) : undefined
      );
      continue;
    }

    const dec = Metadata.validationFor(
      model.constructor as any,
      key as any,
      ValidationKeys.LIST
    );
    // const dec = Reflection.getPropertyDecorators(
    //   ValidationKeys.REFLECT,
    //   model,
    //   key,
    //   true,
    //   true
    // ).decorators.find((d) => d.key === ValidationKeys.LIST);

    if (
      !dec ||
      !model[key as keyof typeof model] ||
      !Array.isArray(model[key as keyof typeof model])
    )
      continue;

    await Promise.all(
      (model[key as keyof typeof model] as Model[]).map((m, i) => {
        return innerLoop(
          m,
          oldModel && oldModel[key as keyof typeof oldModel]
            ? (oldModel[key as keyof typeof oldModel] as any)[i]
            : undefined
        );
      })
    );
  }
}

/**
 * @description Repository implementation backed by TypeORM.
 * @summary Provides CRUD operations for a given Model using the TypeORMAdapter, including bulk operations and query builder access while preserving Decaf.ts repository semantics.
 * @template M Type extending Model that this repository will manage.
 * @param {Adapter<DataSourceOptions, any, TypeORMQuery, TypeORMFlags, Context<TypeORMFlags>>} adapter The adapter used to execute persistence operations.
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
// @uses(TypeORMFlavour)
export class TypeORMRepository<M extends Model<boolean>> extends Repository<
  M,
  TypeORMQuery<M, any>,
  Adapter<
    DataSourceOptions,
    any,
    TypeORMQuery,
    TypeORMFlags,
    Context<TypeORMFlags>
  >,
  TypeORMFlags,
  Context<TypeORMFlags>
> {
  constructor(
    adapter: Adapter<
      DataSourceOptions,
      any,
      TypeORMQuery,
      TypeORMFlags,
      Context<TypeORMFlags>
    >,
    model: Constructor<M>,
    ...args: any[]
  ) {
    super(adapter, model, ...args);
  }

  /**
   * @description Creates a TypeORM query builder for the repository entity.
   * @summary Returns a SelectQueryBuilder bound to this repository's entity for advanced querying.
   * @return {QueryBuilder<M>} A TypeORM SelectQueryBuilder instance.
   */
  queryBuilder(): QueryBuilder<M> {
    const repo = this.nativeRepo();
    return repo.createQueryBuilder();
  }

  /**
   * @description Creates a TypeORM Repository instance for the entity.
   * @summary Returns a Repository bound to this repository's entity for native functionality.
   * @return {NativeRepo<M>} A TypeORM Repository instance.
   */
  nativeRepo(): NativeRepo<M> {
    const clazz = Metadata.constr(this.class);
    return (this.adapter as any).dataSource.getRepository(clazz);
  }

  protected override async createPrefix(
    model: M,
    ...args: any[]
  ): Promise<[M, ...any[]]> {
    const contextArgs = await Context.args<
      M,
      Context<TypeORMFlags>,
      TypeORMFlags
    >(
      OperationKeys.CREATE,
      this.class,
      args,
      this.adapter,
      this._overrides || {}
    );
    model = new this.class(model);
    await enforceDbDecoratorsRecursive(
      this,
      contextArgs.context,
      model,
      OperationKeys.CREATE,
      OperationKeys.ON
    );

    const errors = await Promise.resolve(
      model.hasErrors(
        ...(contextArgs.context.get("ignoredValidationProperties") || [])
      )
    );
    if (errors) throw new ValidationError(errors.toString());

    return [model, ...contextArgs.args];
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
      Metadata.constr(this.class) as any,
      id,
      model as any,
      this.pk,
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
      Metadata.constr(this.class) as any,
      id as string,
      this.pk as string
    );
    return this.adapter.revert<M>(m, this.class, this.pk, id);
  }

  protected override async updatePrefix(
    model: M,
    ...args: any[]
  ): Promise<[M, ...args: any[]]> {
    const contextArgs = await Context.args(
      OperationKeys.UPDATE,
      this.class,
      args,
      this.adapter,
      this._overrides || {}
    );
    const pk = model[this.pk] as string;
    if (!pk)
      throw new InternalError(
        `No value for the Id is defined under the property ${this.pk as string}`
      );
    const oldModel = await this.read(pk, ...contextArgs.args);
    model = this.merge(oldModel, model);
    await enforceDbDecoratorsRecursive(
      this,
      contextArgs.context,
      model,
      OperationKeys.UPDATE,
      OperationKeys.ON,
      oldModel
    );

    const errors = await Promise.resolve(
      model.hasErrors(
        oldModel,
        ...Repository.relations(this.class),
        ...(contextArgs.context.get("ignoredValidationProperties") || [])
      )
    );
    if (errors) throw new ValidationError(errors.toString());
    if (Repository.getMetadata(oldModel)) {
      if (!Repository.getMetadata(model))
        Repository.setMetadata(model, Repository.getMetadata(oldModel));
    }
    return [model, ...contextArgs.args];
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
      Metadata.constr(this.class) as any,
      id,
      model,
      this.pk,
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
      Metadata.constr(this.class) as any,
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
   * @return {Promise<any[]>} The prepared models and forwarded args tuple.
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
        await enforceDbDecoratorsRecursive(
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
      Metadata.constr(this.class) as any,
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
      Metadata.constr(this.class) as any,
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
      Metadata.constr(this.class) as any,
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
      Metadata.constr(this.class) as any,
      keys,
      this.pk as string,
      ...args
    );
    return results.map((r: Record<string, any>, i: number) =>
      this.adapter.revert(r, this.class, this.pk, keys[i])
    );
  }
}
