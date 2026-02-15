import { Model, ValidationKeys } from "@decaf-ts/decorator-validation";
import {
  ContextualizedArgs,
  MaybeContextualArg,
  Repository,
  Adapter,
} from "@decaf-ts/core";
import {
  BulkCrudOperationKeys,
  ContextOfRepository,
  enforceDBDecorators,
  InternalError,
  IRepository,
  OperationKeys,
  PrimaryKeyType,
  reduceErrorsToPrint,
  ValidationError,
} from "@decaf-ts/db-decorators";
import { DataSource, QueryBuilder, Repository as NativeRepo } from "typeorm";
import { type Constructor, Metadata } from "@decaf-ts/decoration";
import type { TypeORMAdapter, TypeORMContext } from "./TypeORMAdapter";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { TypeORMQuery } from "./types";

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
  Adapter<DataSourceOptions, DataSource, TypeORMQuery, TypeORMContext>
> {
  protected override _overrides = Object.assign({}, super["_overrides"], {
    ignoreValidation: false,
    ignoreHandlers: false,
    allowRawStatements: true,
    forcePrepareSimpleQueries: false,
    forcePrepareComplexQueries: false,
  });

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
   * @description Prepares a model for creation.
   * @summary Validates the model and prepares it for creation in the database.
   * @template M - The model type.
   * @param {M} model - The model to create.
   * @param {...any[]} args - Additional arguments.
   * @return The prepared model and context arguments.
   * @throws {ValidationError} If the model fails validation.
   */
  protected override async createPrefix(
    model: M,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<[M, ...any[], TypeORMContext]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, OperationKeys.CREATE, true)
    ).for(this.createPrefix) as ContextualizedArgs<TypeORMContext>;
    const ignoreHandlers = ctx.get("ignoreHandlers");
    const ignoreValidate = ctx.get("ignoreValidation");
    log.silly(
      `handlerSetting: ${ignoreHandlers}, validationSetting: ${ignoreValidate}`
    );
    model = new this.class(model);
    if (!ignoreHandlers)
      await enforceDbDecoratorsRecursive<M, TypeORMRepository<M>, any>(
        this,
        ctx,
        model,
        OperationKeys.CREATE,
        OperationKeys.ON
      );

    if (!ignoreValidate) {
      const propsToIgnore = ctx.get("ignoredValidationProperties") || [];
      log.silly(`ignored validation properties: ${propsToIgnore}`);
      const errors = await Promise.resolve(model.hasErrors(...propsToIgnore));
      if (errors) throw new ValidationError(errors.toString());
    }

    return [model, ...ctxArgs];
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.create
    ) as ContextualizedArgs<TypeORMContext>;
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
  protected override async createSuffix(
    model: M,
    context: TypeORMContext
  ): Promise<M> {
    if (!context.get("ignoreHandlers"))
      await enforceDbDecoratorsRecursive(
        this,
        context as any,
        model,
        OperationKeys.CREATE,
        OperationKeys.AFTER
      );
    return model;
  }
  /**
   * @description Prepares for reading a model by ID.
   * @summary Prepares the context and enforces decorators before reading a model.
   * @param {string} key - The primary key of the model to read.
   * @param {...any[]} args - Additional arguments.
   * @return The key and context arguments.
   */
  protected override async readPrefix(
    key: PrimaryKeyType,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<[PrimaryKeyType, ...any[], TypeORMContext]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, OperationKeys.READ, true)
    ).for(this.readPrefix);

    const ignoreHandlers = ctx.get("ignoreHandlers");
    log.silly(`handlerSetting: ${ignoreHandlers}`);
    const model: M = new this.class();
    model[this.pk] = key as M[keyof M];
    if (!ignoreHandlers)
      await enforceDbDecoratorsRecursive(
        this as any,
        ctx,
        model,
        OperationKeys.READ,
        OperationKeys.ON
      );
    return [key, ...ctxArgs];
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.read
    ) as ContextualizedArgs<TypeORMContext>;
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
  protected override async readSuffix(
    model: M,
    context: TypeORMContext
  ): Promise<M> {
    if (!context.get("ignoreHandlers"))
      await enforceDbDecoratorsRecursive(
        this,
        context as any,
        model,
        OperationKeys.READ,
        OperationKeys.AFTER
      );
    return model;
  }
  /**
   * @description Prepares a model for update.
   * @summary Validates the model and prepares it for update in the database.
   * @param {M} model - The model to update.
   * @param {...any[]} args - Additional arguments.
   * @return The prepared model and context arguments.
   * @throws {InternalError} If the model has no primary key value.
   * @throws {ValidationError} If the model fails validation.
   */
  protected override async updatePrefix(
    model: M,
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<[M, ...args: any[], TypeORMContext, M | undefined]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, OperationKeys.UPDATE, true)
    ).for(this.updatePrefix) as ContextualizedArgs<TypeORMContext>;
    const ignoreHandlers = ctx.get("ignoreHandlers");
    const ignoreValidate = ctx.get("ignoreValidation");
    log.silly(
      `handlerSetting: ${ignoreHandlers}, validationSetting: ${ignoreValidate}`
    );
    const pk = model[this.pk] as string;
    if (!pk)
      throw new InternalError(
        `No value for the Id is defined under the property ${this.pk as string}`
      );
    let oldModel: M | undefined;
    if (ctx.get("applyUpdateValidation")) {
      oldModel = await this.read(pk as string, ctx);
      if (ctx.get("mergeForUpdate"))
        model = Model.merge(oldModel, model, this.class);
    }
    if (!ignoreHandlers)
      await enforceDbDecoratorsRecursive<M, TypeORMRepository<M>, any>(
        this,
        ctx,
        model,
        OperationKeys.UPDATE,
        OperationKeys.ON,
        oldModel
      );

    if (!ignoreValidate) {
      const propsToIgnore = ctx.get("ignoredValidationProperties") || [];
      log.silly(`ignored validation properties: ${propsToIgnore}`);
      const errors = await Promise.resolve(
        model.hasErrors(
          oldModel,
          ...Model.relations(this.class),
          ...propsToIgnore
        )
      );
      if (errors) throw new ValidationError(errors.toString());
    }
    return [model, ...ctxArgs, oldModel];
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
    const { ctxArgs, log, ctx } = this.logCtx(
      args,
      this.update
    ) as ContextualizedArgs<TypeORMContext>;
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

  protected override async updateSuffix(
    model: M,
    oldModel: M,
    context: TypeORMContext
  ): Promise<M> {
    if (!context.get("ignoreHandlers"))
      await enforceDbDecoratorsRecursive(
        this,
        context as any,
        model,
        OperationKeys.UPDATE,
        OperationKeys.AFTER,
        oldModel
      );
    return model;
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.delete
    ) as ContextualizedArgs<TypeORMContext>;
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

  protected override async deleteSuffix(
    model: M,
    context: TypeORMContext
  ): Promise<M> {
    if (!context.get("ignoreHandlers"))
      await enforceDbDecoratorsRecursive(
        this,
        context as any,
        model,
        OperationKeys.DELETE,
        OperationKeys.AFTER
      );
    return model;
  }
  /**
   * @description Prepares multiple models for creation.
   * @summary Validates multiple models and prepares them for creation in the database.
   * @param {M[]} models - The models to create.
   * @param {...any[]} args - Additional arguments.
   * @return The prepared models and context arguments.
   * @throws {ValidationError} If any model fails validation.
   */
  protected override async createAllPrefix(
    models: M[],
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<[M[], ...any[], TypeORMContext]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, BulkCrudOperationKeys.CREATE_ALL, true)
    ).for(this.createAllPrefix) as ContextualizedArgs<TypeORMContext>;
    const ignoreHandlers = ctx.get("ignoreHandlers");
    const ignoreValidate = ctx.get("ignoreValidation");
    log.silly(
      `handlerSetting: ${ignoreHandlers}, validationSetting: ${ignoreValidate}`
    );
    if (!models.length) return [models, ...ctxArgs];
    const opts = Model.sequenceFor(models[0]);
    let ids: (string | number | bigint | undefined)[] = [];
    if (Model.generatedBySequence(this.class)) {
      if (!opts.name) opts.name = Model.sequenceName(models[0], "pk");
      ids = await (
        await this.adapter.Sequence(opts, this._overrides)
      ).range(models.length, ...ctxArgs);
    } else if (!Model.generated(this.class, this.pk)) {
      ids = models.map((m, i) => {
        if (typeof m[this.pk] === "undefined")
          throw new InternalError(
            `Primary key is not defined for model in position ${i}`
          );
        return m[this.pk] as string;
      });
    } else {
      // do nothing. The pk is tagged as generated, so it'll be handled by some other decorator
    }

    models = await Promise.all(
      models.map(async (m, i) => {
        m = new this.class(m);
        if (opts.type) {
          m[this.pk] = (
            opts.type !== "String"
              ? ids[i]
              : opts.generated
                ? ids[i]
                : `${m[this.pk]}`.toString()
          ) as M[keyof M];
        }
        if (!ignoreHandlers)
          await enforceDbDecoratorsRecursive<M, TypeORMRepository<M>, any>(
            this,
            ctx,
            m,
            OperationKeys.CREATE,
            OperationKeys.ON
          );
        return m;
      })
    );
    const timestamp = ctx.timestamp || new Date();
    models = models.map((m) => {
      if ("createdAt" in m) Object.assign(m, { createdAt: timestamp });
      if ("updatedAt" in m) Object.assign(m, { updatedAt: timestamp });
      return m;
    });

    if (!ignoreValidate) {
      const ignoredProps = ctx.get("ignoredValidationProperties") || [];
      log.silly(`ignored validation properties: ${ignoredProps}`);

      const errors = await Promise.all(
        models.map((m) => Promise.resolve(m.hasErrors(...ignoredProps)))
      );

      const errorMessages = reduceErrorsToPrint(errors);

      if (errorMessages) throw new ValidationError(errorMessages);
    }
    return [models, ...ctxArgs];
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.createAll
    ) as ContextualizedArgs<TypeORMContext>;
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

  protected override async createAllSuffix(
    models: M[],
    context: TypeORMContext
  ): Promise<M[]> {
    if (!context.get("ignoreHandlers"))
      await Promise.all(
        models.map((m) =>
          enforceDbDecoratorsRecursive(
            this,
            context as any,
            m,
            OperationKeys.CREATE,
            OperationKeys.AFTER
          )
        )
      );
    return models;
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.readAll
    ) as ContextualizedArgs<TypeORMContext>;
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
  protected override async readAllSuffix(
    models: M[],
    context: TypeORMContext
  ): Promise<M[]> {
    if (!context.get("ignoreHandlers"))
      await Promise.all(
        models.map((m) =>
          enforceDbDecoratorsRecursive(
            this,
            context as any,
            m,
            OperationKeys.READ,
            OperationKeys.AFTER
          )
        )
      );
    return models;
  }
  /**
   * @description Prepares multiple models for update.
   * @summary Validates multiple models and prepares them for update in the database.
   * @param {M[]} models - The models to update.
   * @param {...any[]} args - Additional arguments.
   * @return {Promise<any[]>} The prepared models and context arguments.
   * @throws {InternalError} If any model has no primary key value.
   * @throws {ValidationError} If any model fails validation.
   */
  protected override async updateAllPrefix(
    models: M[],
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<[M[], ...args: any[], TypeORMContext, M[] | undefined]> {
    const { ctx, ctxArgs, log } = (
      await this.logCtx(args, BulkCrudOperationKeys.UPDATE_ALL, true)
    ).for(this.updateAllPrefix) as ContextualizedArgs<TypeORMContext>;

    const ignoreHandlers = ctx.get("ignoreHandlers");
    const ignoreValidate = ctx.get("ignoreValidation");
    log.silly(
      `handlerSetting: ${ignoreHandlers}, validationSetting: ${ignoreValidate}`
    );
    const ids = models.map((m) => {
      const id = m[this.pk] as string;
      if (!id) throw new InternalError("missing id on update operation");
      return id;
    });
    let oldModels: M[] | undefined;
    if (ctx.get("applyUpdateValidation")) {
      oldModels = await this.readAll(ids as string[], ctx);
      if (ctx.get("mergeForUpdate"))
        models = models.map((m, i) =>
          Model.merge((oldModels as any)[i], m, this.class)
        );
    }
    if (!ignoreHandlers)
      await Promise.all(
        models.map((m, i) =>
          enforceDbDecoratorsRecursive<M, TypeORMRepository<M>, any>(
            this,
            ctx,
            m,
            OperationKeys.UPDATE,
            OperationKeys.ON,
            oldModels ? oldModels[i] : undefined
          )
        )
      );

    if (!ignoreValidate) {
      const ignoredProps = ctx.get("ignoredValidationProperties") || [];
      log.silly(`ignored validation properties: ${ignoredProps}`);
      let modelsValidation: any;
      if (!ctx.get("applyUpdateValidation")) {
        modelsValidation = await Promise.resolve(
          models.map((m) => m.hasErrors(...ignoredProps))
        );
      } else {
        modelsValidation = await Promise.all(
          models.map((m, i) =>
            Promise.resolve(
              m.hasErrors((oldModels as any)[i] as any, ...ignoredProps)
            )
          )
        );
      }

      const errorMessages = reduceErrorsToPrint(modelsValidation);

      if (errorMessages) throw new ValidationError(errorMessages);
    }
    return [models, ...ctxArgs, oldModels];
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.updateAll
    ) as ContextualizedArgs<TypeORMContext>;
    log.verbose(
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
  protected override async updateAllSuffix(
    models: M[],
    oldModels: M[] | undefined,
    context: TypeORMContext
  ): Promise<M[]> {
    if (
      context.get("applyUpdateValidation") &&
      !context.get("ignoreDevSafeGuards")
    ) {
      if (!oldModels)
        throw new InternalError("No previous versions of models provided");
    }
    if (!context.get("ignoreHandlers"))
      await Promise.all(
        models.map((m, i) =>
          enforceDbDecoratorsRecursive(
            this,
            context as any,
            m,
            OperationKeys.UPDATE,
            OperationKeys.AFTER,
            oldModels ? oldModels[i] : undefined
          )
        )
      );
    return models;
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
    const { ctx, log, ctxArgs } = this.logCtx(
      args,
      this.create
    ) as ContextualizedArgs<TypeORMContext>;
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
