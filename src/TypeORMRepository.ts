import { Model, ValidationKeys } from "@decaf-ts/decorator-validation";
import { MaybeContextualArg, Repository } from "@decaf-ts/core";
import {
  ContextOfRepository,
  enforceDBDecorators,
  IRepository,
  OperationKeys,
  PrimaryKeyType,
} from "@decaf-ts/db-decorators";
import { QueryBuilder, Repository as NativeRepo } from "typeorm";
import { type Constructor, Metadata } from "@decaf-ts/decoration";
import { TypeORMAdapter, TypeORMContext } from "./TypeORMAdapter";

export async function enforceDbDecoratorsRecursive<
  M extends Model<true | false>,
  R extends IRepository<M, any>,
  V extends object = object,
>(
  repo: R,
  context: ContextOfRepository<R>,
  model: M,
  operation: string,
  prefix: string,
  oldModel?: M
): Promise<void> {
  await enforceDBDecorators<M, R, V>(
    repo,
    context,
    model,
    operation,
    prefix,
    oldModel
  );

  async function innerLoop<N extends Model>(m: N, oldModel?: N) {
    const r = Repository.forModel(m.constructor as Constructor<N>);
    await enforceDbDecoratorsRecursive<N, IRepository<N, any>, any>(
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
export class TypeORMRepository<M extends Model<boolean>> extends Repository<
  M,
  TypeORMAdapter
> {
  constructor(adapter: TypeORMAdapter, model: Constructor<M>, ...args: any[]) {
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

  /**
   * @description Creates and persists a model instance.
   * @summary Prepares the model, delegates insertion to the adapter, and rehydrates the persisted state back into a Model instance.
   * @param {M} model The model to create.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M>} The created model instance.
   */
  override async create(
    model: M,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M> {
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `Creating new ${this.class.name} in table ${Model.tableName(this.class)}`
    );
    // eslint-disable-next-line prefer-const
    let { record, id, transient } = this.adapter.prepare(model, false, ctx);
    record = await this.adapter.create(
      Metadata.constr(this.class),
      id,
      model,
      ...ctxArgs
    );
    return this.adapter.revert<M>(record, this.class, id, transient, ctx);
  }

  /**
   * @description Reads a model from the database by ID.
   * @summary Retrieves a model instance from the database using its primary key.
   * @param {string|number|bigint} id - The primary key of the model to read.
   * @param {...any[]} args - Additional arguments.
   * @return {Promise<M>} The retrieved model instance.
   */
  override async read(
    id: PrimaryKeyType,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M> {
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `reading ${this.class.name} from table ${Model.tableName(this.class)} with pk ${this.pk as string}`
    );

    const m = await this.adapter.read(
      Metadata.constr(this.class),
      id,
      ...ctxArgs
    );
    return this.adapter.revert<M>(m, this.class, id, undefined, ctx);
  }

  /**
   * @description Updates and persists a model instance.
   * @summary Prepares the model, delegates update to the adapter, and rehydrates the persisted state back into a Model instance.
   * @param {M} model The model to update.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M>} The updated model instance.
   */
  override async update(
    model: M,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M> {
    const { ctxArgs, log, ctx } = this.logCtx(args, this.create);
    // eslint-disable-next-line prefer-const
    let { record, id, transient } = this.adapter.prepare(model, false, ctx);
    log.debug(
      `updating ${this.class.name} in table ${Model.tableName(this.class)} with id ${id}`
    );
    record = await this.adapter.update(
      Metadata.constr(this.class),
      id,
      model,
      ...ctxArgs
    );
    return this.adapter.revert<M>(record, this.class, id, transient, ctx);
  }

  /**
   * @description Deletes a model from the database by ID.
   * @summary Removes a model instance from the database using its primary key.
   * @param {string|number|bigint} id - The primary key of the model to delete.
   * @param {...any[]} args - Additional arguments.
   * @return {Promise<M>} The deleted model instance.
   */
  override async delete(
    id: PrimaryKeyType,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M> {
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `deleting new ${this.class.name} in table ${Model.tableName(this.class)} with pk ${id}`
    );

    const m = await this.adapter.delete(
      Metadata.constr(this.class),
      id,
      ...ctxArgs
    );
    return this.adapter.revert<M>(m, this.class, id, undefined, ctx);
  }

  /**
   * @description Creates multiple models at once.
   * @summary Prepares, persists, and rehydrates a batch of models.
   * @param {M[]} models The models to create.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M[]>} The created models.
   */
  override async createAll(
    models: M[],
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M[]> {
    if (!models.length) return models;
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `Creating ${models.length} new ${this.class.name} in table ${Model.tableName(this.class)}`
    );

    const prepared = models.map((m) => this.adapter.prepare(m, false, ctx));
    const ids = prepared.map((p) => p.id);
    let records = prepared.map((p) => p.record);
    records = await this.adapter.createAll(
      Metadata.constr(this.class),
      ids as PrimaryKeyType[],
      models,
      ...ctxArgs
    );
    return records.map((r, i) =>
      this.adapter.revert(
        r,
        this.class,
        ids[i],
        ctx.get("rebuildWithTransient") ? prepared[i].transient : undefined,
        ctx
      )
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
    keys: PrimaryKeyType[],
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M[]> {
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `reading ${keys.length} ${this.class.name} in table ${Model.tableName(this.class)}`
    );

    const records = await this.adapter.readAll(
      Metadata.constr(this.class),
      keys,
      ...ctxArgs
    );
    return records.map((r, i) =>
      this.adapter.revert(r, this.class, keys[i], undefined, ctx)
    );
  }

  /**
   * @description Updates multiple models at once.
   * @summary Persists a batch of model updates and returns their rehydrated instances.
   * @param {M[]} models The models to update.
   * @param {...any[]} args Optional arguments/context.
   * @return {Promise<M[]>} The updated models.
   */
  override async updateAll(
    models: M[],
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M[]> {
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `Updating ${models.length} new ${this.class.name} in table ${Model.tableName(this.class)}`
    );

    const records = models.map((m) => this.adapter.prepare(m, false, ctx));
    const updated = await this.adapter.updateAll(
      Metadata.constr(this.class),
      records.map((r) => r.id),
      models,
      ...ctxArgs
    );
    return updated.map((u, i) =>
      this.adapter.revert(
        u,
        this.class,
        records[i].id,
        ctx.get("rebuildWithTransient") ? records[i].transient : undefined,
        ctx
      )
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
    keys: PrimaryKeyType[],
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<M[]> {
    const { ctx, log, ctxArgs } = this.logCtx(args, this.create);
    log.debug(
      `deleting ${keys.length} ${this.class.name} in table ${Model.tableName(this.class)}`
    );

    const results = await this.adapter.deleteAll(
      Metadata.constr(this.class),
      keys,
      ...ctxArgs
    );
    return results.map((r, i) =>
      this.adapter.revert(r, this.class, keys[i], undefined, ctx)
    );
  }
}
