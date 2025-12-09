import {
  Adapter,
  Cascade,
  CascadeMetadata,
  JoinTableMultipleColumnsOptions,
  JoinTableOptions,
  noValidateOnCreate,
  noValidateOnCreateUpdate,
  OrderDirection,
  PersistenceKeys,
  relation,
  RelationsMetadata,
  Sequence,
  type SequenceOptions,
  ExtendedRelationsMetadata,
  ContextualArgs,
  PreparedModel,
  ConnectionError,
  Repository,
  DefaultSequenceOptions,
} from "@decaf-ts/core";
import { reservedAttributes, TypeORMFlavour } from "./constants";
import {
  BaseError,
  ConflictError,
  Context,
  DBKeys,
  DEFAULT_ERROR_MESSAGES as DB_DEFAULT_ERROR_MESSAGES,
  InternalError,
  NotFoundError,
  onCreate,
  onCreateUpdate,
  OperationKeys,
  PrimaryKeyType,
  readonly,
  UpdateValidationKeys,
} from "@decaf-ts/db-decorators";
import { final } from "@decaf-ts/logging";
import {
  type Constructor,
  Decoration,
  propMetadata,
} from "@decaf-ts/decoration";
import {
  date,
  list,
  MaxLengthValidatorOptions,
  MaxValidatorOptions,
  MinLengthValidatorOptions,
  MinValidatorOptions,
  Model,
  PatternValidatorOptions,
  required,
  type,
  Validation,
  ValidationKeys,
  ValidatorOptions,
} from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { TypeORMStatement } from "./query";
import { TypeORMSequence } from "./sequences";
import { generateIndexes } from "./indexes";
import { TypeORMFlags, TypeORMQuery } from "./types";
import { TypeORMRepository } from "./TypeORMRepository";
import { Logging } from "@decaf-ts/logging";
import { TypeORMDispatch } from "./TypeORMDispatch";
import { convertJsRegexToPostgres, splitEagerRelations } from "./utils";
import {
  ColumnOptions,
  ColumnType,
  DataSource,
  FindOneOptions,
  getMetadataArgsStorage,
  In,
  Index,
  InsertResult,
  JoinColumn,
  JoinColumnOptions,
  JoinTable,
  RelationOptions,
  Repository as Rep,
  SelectQueryBuilder,
  VersionColumn,
} from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { Column } from "./overrides/Column";
import { UpdateDateColumn } from "./overrides/UpdateDateColumn";
import { CreateDateColumn } from "./overrides/CreateDateColumn";
import { OneToOne } from "./overrides/OneToOne";
import { OneToMany } from "./overrides/OneToMany";
import { ManyToOne } from "./overrides/ManyToOne";
import { ManyToMany } from "./overrides/ManyToMany";
import { PrimaryGeneratedColumn } from "./overrides/PrimaryGeneratedColumn";
import { PrimaryColumn } from "./overrides/PrimaryColumn";
import { Entity } from "./overrides/Entity";
import { apply, Metadata, prop } from "@decaf-ts/decoration";
import { PostgresConnectionOptions } from "typeorm/driver/postgres/PostgresConnectionOptions";

export async function createdByOnTypeORMCreateUpdate<
  M extends Model,
  R extends TypeORMRepository<M>,
>(
  this: R,
  context: Context<TypeORMFlags>,
  data: any,
  key: keyof M,
  model: M
): Promise<void> {
  try {
    const user = context.get("user");
    model[key] = user as M[typeof key];
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e: unknown) {
    throw new InternalError(
      "No User found in context. Please provide a user in the context"
    );
  }
}

export type TypeORMContext = Context<TypeORMFlags>;

/**
 * @description Adapter for TypeORM-backed persistence operations.
 * @summary Implements the Decaf.ts Adapter over a TypeORM DataSource, providing CRUD operations, query/statement factories, sequence management, error parsing, and decoration helpers.
 * @template Y The native configuration type (TypeORM DataSourceOptions).
 * @template F The repository flags type.
 * @template C The context type.
 * @param {DataSourceOptions} scope The DataSource options for the adapter.
 * @param {string} flavour The flavour of the adapter.
 * @param {string} [alias] Optional alias for the adapter.
 * @class TypeORMAdapter
 * @example
 * const adapter = new TypeORMAdapter({ type: 'postgres', /* ... *\/ });
 * await adapter.initialize();
 * const repo = new (adapter.repository<User>())(adapter, User);
 * const created = await repo.create(new User({ name: 'Alice' }));
 *
 * @mermaid
 * sequenceDiagram
 *   participant App
 *   participant Adapter as TypeORMAdapter
 *   participant Repo as TypeORMRepository
 *   participant DS as TypeORM DataSource
 *
 *   App->>Adapter: new TypeORMAdapter(opts)
 *   Adapter->>DS: initialize()
 *   App->>Adapter: repository()
 *   Adapter-->>App: TypeORMRepository
 *   App->>Repo: create(model)
 *   Repo->>Adapter: prepare/create/revert
 *   Adapter-->>Repo: Model
 *   Repo-->>App: Model
 */
export class TypeORMAdapter extends Adapter<
  DataSourceOptions,
  DataSource,
  TypeORMQuery,
  TypeORMContext
> {
  override getClient(): DataSource {
    const models = Adapter.models(this.alias);
    const entities = models.map(Metadata.constr);
    return new DataSource(
      Object.assign({}, this.config, { entities: entities })
    );
  }

  constructor(options: DataSourceOptions, alias?: string) {
    super(options, TypeORMFlavour, alias);
  }

  override async shutdown(): Promise<void> {
    await super.shutdown();
    if (this._client) {
      await this._client.destroy();
    }
  }

  protected override async flags<M extends Model>(
    operation: OperationKeys,
    model: Constructor<M>,
    flags: Partial<TypeORMFlags>
  ): Promise<TypeORMFlags> {
    return Object.assign(await super.flags(operation, model, flags), {
      user: (this.config as PostgresConnectionOptions).username,
    });
  }

  @final()
  protected override Dispatch(): TypeORMDispatch {
    return new TypeORMDispatch();
  }

  @final()
  override repository<
    R extends Repository<
      any,
      Adapter<DataSourceOptions, DataSource, TypeORMQuery, TypeORMContext>
    >,
  >(): Constructor<R> {
    return TypeORMRepository as unknown as Constructor<R>;
  }
  /**
   * @description Creates a new Postgres statement for querying
   * @summary Factory method that creates a new PostgresStatement instance for building queries
   * @template M - The model type
   * @return {TypeORMStatement<M, any>} A new PostgresStatement instance
   */
  @final()
  Statement<M extends Model>(): TypeORMStatement<M, any> {
    return new TypeORMStatement(this);
  }

  /**
   * @description Creates a new PostgreSQL sequence
   * @summary Factory method that creates a new PostgreSQLSequence instance for managing sequences
   * @param {SequenceOptions} options - The options for the sequence
   * @return {Promise<Sequence>} A promise that resolves to a new Sequence instance
   */
  @final()
  override async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new TypeORMSequence(options, this);
  }

  /**
   * @description Initializes the adapter by creating indexes for all managed models
   * @summary Sets up the necessary database indexes for all models managed by this adapter
   * @return {Promise<void>} A promise that resolves when initialization is complete
   */
  override async initialize(): Promise<void> {
    const ds = this.client;
    try {
      await ds.initialize();
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    const log = this.log.for(this.initialize);
    log.verbose(`${this.toString()} initialized`);
  }

  /**
   * @description Creates indexes for the given models
   * @summary Abstract method that must be implemented to create database indexes for the specified models
   * @template M - The model type
   * @param {...Constructor<M>} models - The model constructors to create indexes for
   * @return {Promise<void>} A promise that resolves when all indexes are created
   */
  @final()
  protected async index<M extends Model>(
    ...models: Constructor<M>[]
  ): Promise<void> {
    const indexes: TypeORMQuery[] = generateIndexes(models);

    try {
      await this.client.query("BEGIN");

      for (const index of indexes) {
        await this.client.query(index.query, index.values);
      }

      await this.client.query("COMMIT");
    } catch (e: unknown) {
      await this.client.query("ROLLBACK");
      throw this.parseError(e as Error);
    }
  }

  /**
   * @description Executes a raw SQL query against the database
   * @summary Abstract method that must be implemented to execute raw SQL queries
   * @template R - The result type
   * @param {TypeORMQuery} q - The query to execute
   * @return {Promise<R>} A promise that resolves to the query result
   */
  override async raw<R>(
    q: TypeORMQuery,
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<R> {
    const { log } = this.logCtx(args, this.raw);
    try {
      if (!this.client.isInitialized) await this.client.initialize();
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    try {
      const { query, values } = q;
      log.debug(
        `executing query: ${typeof query !== "string" ? (query as unknown as SelectQueryBuilder<any>).getSql() : query}`
      );
      const response = await this.client.query(query, values);
      return response as R;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override prepare<M extends Model>(
    model: M,
    child = false,
    ctx: TypeORMContext
  ): PreparedModel {
    const prepared = super.prepare(model, ctx);

    prepared.record = Object.entries(prepared.record).reduce(
      (accum: Record<string, any>, [key, value]) => {
        if (key === PersistenceKeys.METADATA || this.isReserved(key))
          return accum;
        if (value === undefined) {
          return accum;
        }

        if (value instanceof Date) {
          value = new Date(value.getTime());
        } else if (Model.isModel(value)) {
          value = this.prepare(value, true, ctx).record;
        } else {
          switch (typeof value) {
            case "string":
              value = `${value}`;
              break;
            default:
            //do nothing;
          }
        }
        accum[key] = value;
        return accum;
      },
      {}
    );
    const constr: Constructor<any> | undefined = Model.get(
      model.constructor.name
    );
    if (!constr)
      throw new InternalError(
        `Model ${model.constructor.name} not found in registry`
      );
    const result = child
      ? new (Metadata.constr(constr as any))()
      : new constr();
    if (child)
      Object.defineProperty(result, "constructor", {
        configurable: false,
        enumerable: false,
        value: Metadata,
        writable: false,
      });
    Object.entries(prepared.record).forEach(
      ([key, val]) => (result[key as keyof typeof result] = val)
    );
    prepared.record = result;
    return prepared;
  }

  override revert<M extends Model>(
    obj: Record<string, any>,
    clazz: Constructor<M>,
    id: PrimaryKeyType,
    transient: Record<string, any> | undefined,
    ctx: TypeORMContext
  ): M {
    const log = ctx.logger.for(this.revert);
    if (transient) {
      log.verbose(
        `re-adding transient properties: ${Object.keys(transient).join(", ")}`
      );
      Object.entries(transient).forEach(([key, val]) => {
        if (key in obj)
          throw new InternalError(
            `Transient property ${key} already exists on model ${typeof clazz === "string" ? clazz : clazz.name}. should be impossible`
          );
        (obj as M)[key as keyof M] = val;
      });
    }

    return new (clazz as Constructor<M>)(obj);
  }

  /**
   * @description Creates a new record in the database
   * @summary Abstract method that must be implemented to create a new record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to create
   * @param {...any[]} args - Additional arguments
   * @return {Promise<Record<string, any>>} A promise that resolves to the created record
   */
  override async create<M extends Model>(
    m: Constructor<M>,
    id: PrimaryKeyType,
    model: Record<string, any>,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>> {
    const repo: Rep<M> = this.client.getRepository(m);
    if (typeof id !== "undefined") {
      const pk = Model.pk(m) as string;
      const existing = await repo.findOne({
        where: {
          [pk]: id as string,
        } as any,
      });
      if (existing) {
        throw new ConflictError(
          `Record already exists in table ${Model.tableName(m)} with id: ${id}`
        );
      }
    }
    try {
      return await repo.save(model as any);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  /**
   * @description Reads a record from the database
   * @summary Abstract method that must be implemented to read a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {string} pk - primary key colum
   * @return {Promise<Record<string, any>>} A promise that resolves to the read record
   */
  override async read<M extends Model>(
    m: Constructor<M>,
    id: PrimaryKeyType,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>> {
    let result: any;
    try {
      const repo = this.client.getRepository(m);
      const { nonEager, relations } = splitEagerRelations(m);
      const pk = Model.pk(m) as string;
      const q: FindOneOptions = {
        where: {
          [pk]: id,
        },
        relations: relations,
        loadRelationIds: {
          relations: nonEager,
        },
      };
      result = (await repo.findOneOrFail(q)) as Record<string, any>;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    return result;
  }

  /**
   * @description Updates a record in the database
   * @summary Abstract method that must be implemented to update a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to update
   * @param {string} pk - Additional arguments
   * @return A promise that resolves to the updated record
   */
  override async update<M extends Model>(
    m: Constructor<M>,
    id: string | number,
    model: Record<string, any>,
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>> {
    const { ctx } = this.logCtx(args, this.update);
    await this.read(m, id, ctx);
    try {
      const repo = this.client.getRepository(m);
      return repo.save(model as any);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  /**
   * @description Deletes a record from the database
   * @summary Abstract method that must be implemented to delete a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {string} pk - Additional arguments
   * @return A promise that resolves to the deleted record
   */
  override async delete<M extends Model>(
    m: Constructor<M>,
    id: PrimaryKeyType,
    ...args: any[]
  ): Promise<Record<string, any>> {
    const { ctx } = this.logCtx(args, this.delete);
    const model = await this.read(m, id, ctx);
    try {
      const repo = this.client.getRepository(m);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const res = await repo.delete(id as any);
      return model;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override async createAll<M extends Model>(
    m: Constructor<M>,
    id: PrimaryKeyType[],
    model: Record<string, any>[],
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>[]> {
    const { ctx } = this.logCtx(args, this.createAll);

    try {
      const repo = this.client.getRepository(m);
      const result: InsertResult = await repo.insert(model);
      return this.readAll(
        m,
        result.identifiers.map((id) => id.id),
        ctx
      );
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override async readAll<M extends Model>(
    m: Constructor<M>,
    id: PrimaryKeyType[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>[]> {
    if (!id.length) return [];

    try {
      const pk = Model.pk(m) as string;
      const repo = this.client.getRepository(m);
      return repo.findBy({ [pk]: In(id) } as any);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override async updateAll<M extends Model>(
    clazz: Constructor<M>,
    ids: PrimaryKeyType[],
    model: Record<string, any>[],
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>[]> {
    const result = [];
    const pk = Model.pk(clazz) as string;
    for (const m of model) {
      result.push(await this.update(clazz, m[pk], m, ...args));
    }
    return result;
  }

  override async deleteAll<M extends Model>(
    m: Constructor<M>,
    ids: PrimaryKeyType[],
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<Record<string, any>[]> {
    if (!ids.length) return [];
    const { ctx } = this.logCtx(args, this.deleteAll);
    try {
      const repo = this.client.getRepository(m);
      const models = await this.readAll(m, ids, ctx);
      const pk = Model.pk(m) as string;
      await repo.delete({ [pk]: In(ids) } as any);
      return models;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  /**
   * @description Parses an error and converts it to a BaseError
   * @summary Converts various error types to appropriate BaseError subtypes
   * @param {Error|string} err - The error to parse
   * @param {string} [reason] - Optional reason for the error
   * @return {BaseError} The parsed error as a BaseError
   */
  parseError<E extends BaseError>(err: Error | string, reason?: string): E {
    return TypeORMAdapter.parseError<E>(err, reason);
  }

  /**
   * @description Checks if an attribute is reserved
   * @summary Determines if an attribute name is reserved in PostgreSQL
   * @param {string} attr - The attribute name to check
   * @return {boolean} True if the attribute is reserved, false otherwise
   */
  protected override isReserved(attr: string): boolean {
    return !!attr.match(reservedAttributes);
  }

  /**
   * @description Static method to parse an error and convert it to a BaseError
   * @summary Converts various error types to appropriate BaseError subtypes based on PostgreSQL error codes and messages
   * @param {Error|string} err - The error to parse
   * @param {string} [reason] - Optional reason for the error
   * @return {BaseError} The parsed error as a BaseError
   * @mermaid
   * sequenceDiagram
   *   participant Caller
   *   participant parseError
   *   participant ErrorTypes
   *
   *   Caller->>parseError: err, reason
   *   Note over parseError: Check if err is already a BaseError
   *   alt err is BaseError
   *     parseError-->>Caller: return err
   *   else err is string
   *     Note over parseError: Extract code from string
   *     alt code matches "duplicate key|already exists"
   *       parseError->>ErrorTypes: new ConflictError(code)
   *       ErrorTypes-->>Caller: ConflictError
   *     else code matches "does not exist|not found"
   *       parseError->>ErrorTypes: new NotFoundError(code)
   *       ErrorTypes-->>Caller: NotFoundError
   *     end
   *   else err has code property
   *     Note over parseError: Extract code and reason
   *   else
   *     Note over parseError: Use err.message as code
   *   end
   *
   *   Note over parseError: Switch on PostgreSQL error code
   *   alt code is 23505 (unique_violation)
   *     parseError->>ErrorTypes: new ConflictError(reason)
   *     ErrorTypes-->>Caller: ConflictError
   *   else code is 23503 (foreign_key_violation)
   *     parseError->>ErrorTypes: new ConflictError(reason)
   *     ErrorTypes-->>Caller: ConflictError
   *   else code is 42P01 (undefined_table)
   *     parseError->>ErrorTypes: new NotFoundError(reason)
   *     ErrorTypes-->>Caller: NotFoundError
   *   else code is 42703 (undefined_column)
   *     parseError->>ErrorTypes: new NotFoundError(reason)
   *     ErrorTypes-->>Caller: NotFoundError
   *   else code is 42P07 (duplicate_table)
   *     parseError->>ErrorTypes: new ConflictError(reason)
   *     ErrorTypes-->>Caller: ConflictError
   *   else code is 42P16 (invalid_table_definition)
   *     parseError->>ErrorTypes: new IndexError(err)
   *     ErrorTypes-->>Caller: IndexError
   *   else code matches "ECONNREFUSED"
   *     parseError->>ErrorTypes: new ConnectionError(err)
   *     ErrorTypes-->>Caller: ConnectionError
   *   else
   *     parseError->>ErrorTypes: new InternalError(err)
   *     ErrorTypes-->>Caller: InternalError
   *   end
   */
  protected static parseError<E extends BaseError>(
    err: Error | string,
    reason?: string
  ): E {
    if (err instanceof BaseError) return err as any;
    const code: string = typeof err === "string" ? err : err.message;

    if (code.match(/duplicate key|already exists/g))
      return new ConflictError(code) as E;
    if (code.match(/does not exist|not found|Could not find/g))
      return new NotFoundError(code) as E;

    // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    switch (code.toString()) {
      // Integrity constraint violations
      case "23505": // unique_violation
      case "23503": // foreign_key_violation
      case "42P07": // duplicate_table
        return new ConflictError(reason as string) as E;

      // Object not found errors
      case "42P01": // undefined_table
      case "42703": // undefined_column
        return new NotFoundError(reason as string) as E;

      // Invalid object definition
      case "42P16": // invalid_table_definition
        return new IndexError(err) as E;

      // Connection errors
      default:
        if (code.toString().match(/ECONNREFUSED/g))
          return new ConnectionError(err) as E;
        return new InternalError(err) as E;
    }
  }

  static async connect(config: DataSourceOptions): Promise<DataSource> {
    const con = new DataSource(config);
    if (!con.isInitialized) await con.initialize();
    return con;
  }

  static async createDatabase(
    dataSource: DataSource,
    dbName: string
  ): Promise<void> {
    const log = Logging.for(this.createDatabase);
    log.verbose(`Creating database ${dbName}`);
    try {
      await dataSource.query(`CREATE DATABASE ${dbName}`);
      log.info(`Created database ${dbName}`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  static async createNotifyFunction(
    dataSource: DataSource,
    user: string
  ): Promise<void> {
    const log = Logging.for(this.createNotifyFunction);
    log.verbose(`Creating notify function`);
    try {
      await dataSource.query(
        `CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'table_changes',
        json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'data', row_to_json(NEW),
            'old_data', row_to_json(OLD)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
;`
      );
      await dataSource.query(
        `ALTER FUNCTION notify_table_changes() OWNER TO ${user};`
      );
      await dataSource.query(`
            GRANT EXECUTE ON FUNCTION notify_table_changes() TO public;
        `);
      log.info(`Created notify function`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  static async deleteDatabase(
    dataSource: DataSource,
    dbName: string,
    user?: string
  ): Promise<void> {
    try {
      if (user) await dataSource.query(`DROP OWNED BY ${user} CASCADE;`);
      await dataSource.query(`DROP DATABASE ${dbName}`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  static async createUser(
    dataSource: DataSource,
    dbName: string,
    user: string,
    password: string
  ): Promise<void> {
    try {
      await dataSource.query(`CREATE USER ${user} WITH PASSWORD '${password}'`);
      await dataSource.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${user}`);

      await dataSource.query(`GRANT USAGE ON SCHEMA public TO ${user}`);
      await dataSource.query(`GRANT CREATE ON SCHEMA public TO ${user}`);
      await dataSource.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${user}`
      );
      await dataSource.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${user}`
      );
      await dataSource.query(
        `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${user}`
      );
      await dataSource.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${user}`
      );
      await dataSource.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${user}`
      );
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  static async deleteUser(
    client: DataSource,
    user: string,
    admin: string
  ): Promise<void> {
    try {
      await client.query(`REASSIGN OWNED BY ${user} TO ${admin}`);
      await client.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${user}`
      );
      await client.query(`REVOKE ALL ON SCHEMA public FROM ${user}`);
      await client.query(
        `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${user}`
      );
      await client.query(
        `REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${user}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${admin} IN SCHEMA public REVOKE ALL ON TABLES FROM ${user}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${admin} IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${user};`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE ${admin} IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${user}`
      );
      await client.query(`DROP OWNED BY ${user} CASCADE`);
      await client.query(`DROP USER IF EXISTS "${user}"`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  private static parseTypeToPostgres(
    type: string,
    isPk: boolean,
    isFk = false
  ) {
    switch (type.toLowerCase()) {
      case "string":
        return isPk ? "TEXT PRIMARY KEY" : isFk ? "TEXT" : "VARCHAR";
      case "number":
        return isPk ? "SERIAL PRIMARY KEY" : "INTEGER";
      case "boolean":
        return "BOOLEAN";
      case "date":
        return "TIMESTAMP";
      case "bigint":
        return isPk ? "BIGINT PRIMARY KEY" : "BIGINT";
      default: {
        const m = Model.get(type);
        if (m) {
          const type = Metadata.type(m, Model.pk(m));
          // Reflection.getTypeFromDecorator(
          //   mm,
          //   Model.pk(mm)
          // );
          return {
            model: m,
            pkType: type,
          };
        }
        throw new InternalError(`Unsupported type: ${type}`);
      }
    }
  }

  private static parseValidationToPostgres(
    prop: string,
    type: string,
    isPk: boolean,
    key: string,
    options: ValidatorOptions
  ) {
    switch (key) {
      case ValidationKeys.REQUIRED:
        return "NOT NULL";
      case ValidationKeys.MAX_LENGTH:
        if (isPk || !options || type.toLowerCase() !== "string") {
          return "";
        }
        return `(${(options as MaxLengthValidatorOptions)[ValidationKeys.MAX_LENGTH]})`;
      case ValidationKeys.MIN_LENGTH:
        return `CONSTRAINT ${prop}_min_length_check CHECK (LENGTH(${prop}) >= ${(options as MinLengthValidatorOptions)[ValidationKeys.MIN_LENGTH]})`;
      case ValidationKeys.PATTERN:
      case ValidationKeys.URL:
      case ValidationKeys.EMAIL:
        return `CONSTRAINT ${prop}_pattern_check CHECK (${prop} ~ '${convertJsRegexToPostgres((options as PatternValidatorOptions)[ValidationKeys.PATTERN] as string)}')`;
      case ValidationKeys.TYPE:
      case ValidationKeys.DATE:
        return "";
      case ValidationKeys.MIN:
        return `CONSTRAINT ${prop}_${key}_check CHECK (${prop} >= ${(options as MinValidatorOptions)[ValidationKeys.MIN]})`;
      case ValidationKeys.MAX:
        return `CONSTRAINT ${prop}_${key}_check CHECK (${prop} <= ${(options as MaxValidatorOptions)[ValidationKeys.MAX]})`;
      case ValidationKeys.PASSWORD:
      default:
        throw new InternalError(`Unsupported type: ${key}`);
    }
  }

  private static parseRelationsToPostgres(
    prop: string,
    clazz: Constructor<Model>,
    pk: string,
    key: PersistenceKeys,
    options: RelationsMetadata
  ) {
    const tableName = Model.tableName(clazz);
    const { cascade } = options;
    const cascadeStr = `${cascade.update ? " ON UPDATE CASCADE" : ""}${cascade.delete ? " ON DELETE CASCADE" : ""}`;
    switch (`relations${key}`) {
      case PersistenceKeys.ONE_TO_ONE:
        return `FOREIGN KEY (${prop}) REFERENCES ${tableName}(${pk})${cascadeStr}`;
      default:
        throw new InternalError(`Unsupported operation: ${key}`);
    }
  }
  //
  //   static async createTable<M extends Model>(
  //     client: DataSource,
  //     model: Constructor<M>
  //   ): Promise<Record<string, TypeORMTableSpec>> {
  //     const result: Record<string, TypeORMTableSpec> = {};
  //     // const m = new model({});
  //     const tableName = Repository.table(model);
  //     const id = Model.pk(model, true)
  //
  //     let isPk: boolean, column: string;
  //
  //     const properties = Metadata.properties(model) || []
  //     for (const prop of properties) {
  //       // if (
  //       //   typeof (this as any)[prop] === "function" ||
  //       //   prop.toString().startsWith("_") ||
  //       //   prop === "constructor"
  //       // ) {
  //       //   continue;
  //       // }
  //
  //       isPk = prop === id;
  //       column = Repository.column(model, prop.toString());
  //
  //       const allDecs = Metadata.validationFor(model,  prop)
  //
  //       const decoratorData = allDecs.decorators.reduce(
  //         (accum: Record<string, any>, el) => {
  //           const { key, props } = el;
  //           if (key === ModelKeys.TYPE && !accum[ValidationKeys.TYPE]) {
  //             accum[ValidationKeys.TYPE] = {
  //               customTypes: [props.name as string],
  //               message: DEFAULT_ERROR_MESSAGES.TYPE,
  //               description: "defines the accepted types for the attribute",
  //             };
  //           } else if (key !== ValidationKeys.TYPE) {
  //             // do nothing. we can only support basis ctypes at this time
  //             accum[key] = props;
  //           }
  //           return accum;
  //         },
  //         {}
  //       );
  //
  //       const dbDecs = Reflection.getPropertyDecorators(
  //         Repository.key("relations"),
  //         m,
  //         prop.toString(),
  //         true,
  //         true
  //       );
  //
  //       const query: string[] = [];
  //       const constraints: string[] = [];
  //       const foreignKeys: string[] = [];
  //       let typeData: TypeMetadata | undefined = undefined;
  //       let childClass: Constructor<Model> | undefined = undefined;
  //       let childPk: any;
  //
  //       if (Object.keys(decoratorData).length) {
  //         typeData = decoratorData[ValidationKeys.TYPE] as TypeMetadata;
  //
  //         if (!typeData) {
  //           throw new Error(`Missing type information`);
  //         }
  //
  //         let parsedType:
  //           | string
  //           | { model: Constructor<Model> | string; pkType?: string } =
  //           this.parseTypeToPostgres(
  //             typeof (typeData.customTypes as any[])[0] === "function"
  //               ? (typeData.customTypes as any)[0]()
  //               : (typeData.customTypes as any)[0],
  //             isPk
  //           );
  //         if (typeof parsedType === "string") {
  //           parsedType = { model: parsedType };
  //         }
  //         let typeStr:
  //           | string
  //           | { model: Constructor<Model> | string; pkType?: string } =
  //           parsedType.model as
  //             | string
  //             | { model: Constructor<Model> | string; pkType?: string };
  //
  //         if (typeof typeStr !== "string") {
  //           if (Array.isArray(typeStr)) {
  //             console.log(typeStr);
  //           }
  //
  //           // continue;
  //           // const res: Record<string, PostgresTableSpec> = await this.createTable(pool, typeStr);
  //           try {
  //             childClass = parsedType.model as Constructor<Model>;
  //             const m = new childClass();
  //             childPk = findPrimaryKey(m);
  //             typeStr = this.parseTypeToPostgres(
  //               parsedType.pkType as string,
  //               false,
  //               true
  //             );
  //             await this.createTable(client, childClass);
  //           } catch (e: unknown) {
  //             if (!(e instanceof ConflictError)) throw e;
  //           }
  //         }
  //
  //         let tp = Array.isArray(typeData.customTypes)
  //           ? typeData.customTypes[0]
  //           : typeData.customTypes;
  //         tp = typeof tp === "function" && !tp.name ? tp() : tp;
  //         const validationStr = this.parseValidationToPostgres(
  //           column,
  //           tp as any,
  //           isPk,
  //           ValidationKeys.MAX_LENGTH,
  //           (decoratorData[
  //             ValidationKeys.MAX_LENGTH
  //           ] as MaxLengthValidatorOptions) || {
  //             [ValidationKeys.MAX_LENGTH]: 255,
  //           }
  //         );
  //
  //         const q = `${column} ${typeStr}${validationStr}`;
  //
  //         if (isPk) {
  //           query.unshift(q);
  //         } else {
  //           query.push(q);
  //         }
  //
  //         for (const [key, props] of Object.entries(decoratorData).filter(
  //           ([k]) =>
  //             ![ValidationKeys.TYPE, ValidationKeys.MAX_LENGTH].includes(k as any)
  //         )) {
  //           const validation = this.parseValidationToPostgres(
  //             column,
  //             tp as any,
  //             isPk,
  //             key,
  //             props
  //           );
  //           if (validation.startsWith("CONSTRAINT")) {
  //             constraints.push(validation);
  //           } else {
  //             if (validation) {
  //               query.push(validation);
  //             }
  //           }
  //         }
  //       }
  //
  //       // TODO ignore for now. this leaves foreign keys out
  //       // eslint-disable-next-line no-constant-binary-expression
  //       if (false || (dbDecs && dbDecs.decorators.length)) {
  //         if (!typeData) throw new Error(`Missing type information`);
  //         for (const decorator of dbDecs.decorators) {
  //           const { key, props } = decorator;
  //           const validation = this.parseRelationsToPostgres(
  //             column,
  //             childClass as Constructor<Model>,
  //             childPk.id,
  //             key as PersistenceKeys,
  //             props as unknown as RelationsMetadata
  //           );
  //           if (validation.startsWith("FOREIGN")) {
  //             foreignKeys.push(validation);
  //           } else {
  //             throw new InternalError(`Unsupported relation: ${key}`);
  //           }
  //         }
  //       }
  //
  //       result[prop.toString()] = {
  //         query: query.join(" "),
  //         values: [],
  //         primaryKey: isPk,
  //         constraints: constraints,
  //         foreignKeys: foreignKeys,
  //       };
  //     }
  //
  //     const values = Object.values(result);
  //     const query = values.map((r) => r.query).join(",\n");
  //     const constraints = values
  //       .filter((c) => !!c.constraints.length)
  //       .map((r) => r.constraints)
  //       .join(",\n");
  //     const foreignKeys = values
  //       .filter((c) => !!c.foreignKeys.length)
  //       .map((r) => r.foreignKeys)
  //       .join(",\n");
  //     const vals = [query, constraints];
  //     if (foreignKeys) {
  //       vals.push(foreignKeys);
  //     }
  //     const queryString = `CREATE TABLE ${tableName} (${vals.filter((v) => !!v).join(",\n")})`;
  //     try {
  //       await client.query(queryString);
  //       await client.query(
  //         `CREATE TRIGGER notify_changes_${tableName}
  // AFTER INSERT OR UPDATE OR DELETE ON ${tableName}
  //     FOR EACH ROW
  //     EXECUTE FUNCTION notify_table_changes();`
  //       );
  //     } catch (e: unknown) {
  //       throw this.parseError(e as Error);
  //     }
  //     return result;
  //   }

  static async getCurrentUser(client: DataSource): Promise<string> {
    const queryString = `SELECT CURRENT_USER;`;
    try {
      const result = await client.query(queryString);
      return result[0].current_user;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  static override decoration() {
    super.decoration();

    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.TABLE)
      .extend({
        decorator: function overrideTable(name?: string) {
          return function tableDecorator(target: any) {
            const ctor = Metadata.constr(target);
            const storage = getMetadataArgsStorage();
            const existing = storage.tables.find(
              (table) => table.target === ctor
            );
            if (existing) {
              if (name) {
                existing.name = name;
              }
              return target;
            }
            const tableName =
              name ||
              (() => {
                try {
                  return Model.tableName(ctor as Constructor<Model>);
                } catch {
                  return ctor?.name;
                }
              })();
            Entity(tableName)(ctor);
            return target;
          };
        },
      })
      .apply();

    // @pk() => @PrimaryGeneratedColumn() | @PrimaryColumn()
    function pkDec(options: SequenceOptions) {
      return function pkDec(original: any, propertyKey: any) {
        const ctor = Metadata.constr(original.constructor);
        const storage = getMetadataArgsStorage();
        if (!storage.tables.find((table) => table.target === ctor)) {
          const tableName =
            (() => {
              try {
                return Model.tableName(ctor as Constructor<Model>);
              } catch {
                return ctor?.name;
              }
            })() || ctor?.name;
          Entity(tableName)(ctor);
        }
        prop()(original, propertyKey);
        const decorators: any[] = [
          required(),
          readonly(),
          propMetadata(Metadata.key(DBKeys.ID, propertyKey), options),
        ];
        let type =
          options.type || Metadata.type(original.constructor, propertyKey);
        switch (type) {
          case String.name || String.name.toLowerCase():
          case String:
            options.generated = false;
            break;
          case Number.name || String.name.toLowerCase():
          case Number:
            options.generated = true;
            break;
          case BigInt.name || BigInt.name.toLowerCase():
          case BigInt:
            options.generated = true;
            break;
          case "uuid":
          case "serial":
            options.generated = true;
            break;
          default:
            throw new Error("Unsupported type");
        }
        if (typeof options.generated === "undefined") {
          options.generated = true;
        }

        if (!type)
          throw new InternalError(
            `Missing type information for property ${propertyKey} of ${original.name}`
          );
        if (options.generated) {
          const name =
            options.name || Model.sequenceName(original.constructor, "pk");
          const conf = {
            name: name,
          };
          if (options.type === "serial" || options.type === "uuid") {
            decorators.push(
              PrimaryGeneratedColumn(
                (options.type === "uuid" ? options.type : "identity") as "uuid",
                conf
              )
            );
          } else {
            decorators.push(PrimaryGeneratedColumn(conf));
          }
          decorators.push(noValidateOnCreate());
        } else {
          const typename =
            typeof type === "function" && (type as any)?.name
              ? (type as any).name
              : type;

          switch (typename) {
            case Number.name || Number.name.toLowerCase():
              type = "numeric";
              break;
            case "serial":
            case "uuid":
              break;
            case String.name || String.name.toLowerCase():
              type = "varchar";
              break;
            case BigInt.name || BigInt.name.toLowerCase():
              type = "bigint";
              break;
            default:
              throw new InternalError(`Unsupported type: ${type}`);
          }
          decorators.push(
            PrimaryColumn({
              type: type as ColumnType,
              unique: true,
            })
          );
        }
        return apply(...decorators)(original, propertyKey);
      };
    }

    Decoration.flavouredAs(TypeORMFlavour)
      .for(DBKeys.ID)
      .define({
        decorator: pkDec,
      } as any)
      .apply();

    // @column("columnName") => @Column({name: "columnName"})
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.COLUMN)
      .extend({
        decorator: function columm(name: string) {
          return function column(obj: any, prop: any) {
            const opts: ColumnOptions = {};
            if (name) opts.name = name;
            let pk: string | undefined;
            try {
              pk = Model.pk(obj.constructor as Constructor<any>) as string;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
            } catch (e: unknown) {
              pk = undefined; // hasn't been defined yet. means this isn't it
            }
            if (pk !== prop) {
              opts.nullable = true;
            }
            return Column(opts)(obj, prop);
          };
        },
      })
      .apply();

    // @unique => @Column({unique: true})
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.UNIQUE)
      .define(propMetadata(PersistenceKeys.UNIQUE, {}))
      .extend(Column({ unique: true }))
      .apply();

    // @required => @Column({ nullable: false })
    const requiredKey = Validation.key(ValidationKeys.REQUIRED);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(requiredKey)
      .extend(Column({ nullable: false }))
      .apply();

    // @version => @VersionColumn()
    Decoration.flavouredAs(TypeORMFlavour)
      .for(DBKeys.VERSION)
      .define(type(Number), VersionColumn(), noValidateOnCreate())
      .apply();

    function ValidationUpdateKey(key: string) {
      return UpdateValidationKeys.REFLECT + key;
    }

    // @timestamp(op) => @CreateDateColumn() || @UpdateDateColumn()
    const timestampDecorationKey = DBKeys.TIMESTAMP;
    const timestampUpdateKey = ValidationUpdateKey(DBKeys.TIMESTAMP);

    function ts(operation: OperationKeys[], format: string) {
      const decorators: any[] = [
        date(format, DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.DATE),
        required(DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.REQUIRED),
        propMetadata(Validation.key(DBKeys.TIMESTAMP), {
          operation: operation,
          format: format,
        }),
        noValidateOnCreate(),
      ];
      if (operation.indexOf(OperationKeys.UPDATE) !== -1)
        decorators.push(
          propMetadata(timestampUpdateKey, {
            message: DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.INVALID,
          }),
          noValidateOnCreateUpdate()
        );
      else decorators.push(readonly());
      return apply(...decorators);
    }

    Decoration.flavouredAs(TypeORMFlavour)
      .for(timestampDecorationKey)
      .define({
        decorator: ts,
      } as any)
      .extend({
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        decorator: function timestamp(ops: OperationKeys[], format: string) {
          return function timestamp(obj: any, prop: any) {
            if (ops.indexOf(OperationKeys.UPDATE) !== -1)
              return UpdateDateColumn()(obj, prop);
            return CreateDateColumn()(obj, prop);
          };
        },
        // transform: (args: any[]) => {
        //   return args[0];
        // },
      })
      .apply();

    // @oneToOne(clazz) => @OneToOne(() => clazz)
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.ONE_TO_ONE)
      .define({
        decorator: function oneToOne(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinColumnOpts?: JoinColumnOptions,
          fk?: string
        ) {
          const metadata: RelationsMetadata = {
            class: clazz,
            cascade: cascade,
            populate: populate,
          };
          if (joinColumnOpts) metadata.joinTable = joinColumnOpts;
          if (fk) metadata.name = fk;
          const ormMeta: RelationOptions = {
            cascade:
              cascade.update === Cascade.CASCADE ||
              cascade.delete === Cascade.CASCADE,
            onDelete: cascade.delete ? "CASCADE" : "DEFAULT",
            onUpdate: cascade.update ? "CASCADE" : "DEFAULT",
            nullable: true,
            eager: populate,
          };
          return apply(
            prop(),
            relation(PersistenceKeys.ONE_TO_ONE, metadata),
            type([clazz, String, Number, BigInt]),
            propMetadata(PersistenceKeys.ONE_TO_ONE, metadata),
            OneToOne(
              () => {
                if (typeof clazz === "function" && !(clazz as any).name)
                  clazz = (clazz as any)();
                const constr = Metadata.constr(clazz as Constructor<any>);
                if (constr === clazz)
                  throw new InternalError(
                    "Original Model not found in constructor"
                  );
                return constr;
              },
              (model: any) => {
                if (typeof clazz === "function" && !(clazz as any).name)
                  clazz = (clazz as any)();
                const pk = Model.pk(clazz as Constructor<any>);
                return model[pk];
              },
              ormMeta
            ),
            JoinColumn(
              joinColumnOpts || metadata.name
                ? {
                    foreignKeyConstraintName: metadata.name,
                  }
                : (undefined as any)
            )
          );
        },
      } as any)
      .apply();

    // @oneToMany(clazz) => @OneToMany(() => clazz)
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.ONE_TO_MANY)
      .define({
        decorator: function oneToMany(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinTableOpts?: JoinTableOptions | JoinTableMultipleColumnsOptions,
          fk?: string
        ) {
          const meta: RelationsMetadata = {
            class: clazz,
            cascade: cascade,
            populate: populate,
          };
          if (joinTableOpts) meta.joinTable = joinTableOpts;
          if (fk) meta.name = fk;

          const decorators = [
            prop(),
            relation(PersistenceKeys.ONE_TO_MANY, meta),
            list(clazz),
            propMetadata(PersistenceKeys.ONE_TO_MANY, meta),
            function OneToManyWrapper(obj: any, prop: any): any {
              const ormMeta: RelationOptions = {
                cascade:
                  cascade.update === Cascade.CASCADE ||
                  cascade.delete === Cascade.CASCADE,
                onDelete: cascade.delete ? "CASCADE" : "DEFAULT",
                onUpdate: cascade.update ? "CASCADE" : "DEFAULT",
                nullable: true,
                eager: populate,
              };
              return OneToMany(
                () => {
                  if (typeof clazz === "function" && !(clazz as any).name)
                    clazz = (clazz as any)();
                  const constr = Metadata.constr(clazz as Constructor<any>);
                  if (constr === clazz)
                    throw new InternalError(
                      "Original Model not found in constructor"
                    );
                  return constr;
                },
                (model: any) => {
                  if (typeof clazz === "function" && !(clazz as any).name)
                    clazz = (clazz as any)();
                  const relations = Metadata.relations(
                    clazz as Constructor<any>
                  );
                  if (!relations)
                    throw new InternalError(
                      `No relations found on model ${clazz.name}`
                    );
                  const crossRelationKey = relations.find((r) => {
                    const meta: ExtendedRelationsMetadata = Model.relations(
                      clazz as any,
                      r as any
                    );
                    if (meta.key !== PersistenceKeys.MANY_TO_ONE) return false;
                    const c =
                      typeof meta.class === "function" &&
                      !(meta.class as any).name
                        ? (meta.class as any)()
                        : meta.class;
                    const ref = Metadata.constr(
                      obj.constructor as Constructor<any>
                    );
                    return c.name === ref.name;
                  });
                  if (!crossRelationKey)
                    throw new InternalError(
                      `Cross relation not found. Did you use @manyToOne on the ${clazz.name}?`
                    );
                  return model[crossRelationKey];
                },
                ormMeta
              )(obj, prop);
            },
          ];
          return apply(...decorators);
        },
      } as any)
      .apply();

    // @manyToOne(clazz) => @ManyToOne(() => clazz)
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.MANY_TO_ONE)
      .define({
        decorator: function manyToOne(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinTableOpts?: JoinTableOptions | JoinTableMultipleColumnsOptions,
          fk?: string
        ) {
          const metadata: RelationsMetadata = {
            class: clazz,
            cascade: cascade,
            populate: populate,
          };
          if (joinTableOpts) metadata.joinTable = joinTableOpts;
          if (fk) metadata.name = fk;
          const ormMeta: RelationOptions = {
            cascade:
              cascade.update === Cascade.CASCADE ||
              cascade.delete === Cascade.CASCADE,
            onDelete: cascade.delete ? "CASCADE" : "NO ACTION",
            onUpdate: cascade.update ? "CASCADE" : "NO ACTION",
            nullable: true,
            eager: populate,
          };
          return apply(
            relation(PersistenceKeys.MANY_TO_ONE, metadata),
            type([clazz, String, Number, BigInt]),
            propMetadata(PersistenceKeys.MANY_TO_ONE, metadata),
            function ManyToOneWrapper(obj: any, prop: any): any {
              return ManyToOne(
                () => {
                  if (typeof clazz === "function" && !(clazz as any).name)
                    clazz = (clazz as any)();
                  const constr = Metadata.constr(clazz as Constructor<any>);
                  if (constr === clazz)
                    throw new InternalError(
                      "Original Model not found in constructor"
                    );
                  return constr;
                },
                (model: any) => {
                  if (typeof clazz === "function" && !(clazz as any).name)
                    clazz = (clazz as any)();
                  const relations = Metadata.relations(clazz as Constructor);

                  let crossRelationKey = Model.pk(clazz);

                  if (!relations) return model[crossRelationKey];

                  crossRelationKey =
                    relations.find((r) => {
                      const meta: ExtendedRelationsMetadata = Model.relations(
                        clazz as any,
                        r as any
                      );
                      if (meta.key !== PersistenceKeys.ONE_TO_MANY)
                        return false;
                      const c =
                        typeof meta.class === "function" &&
                        !(meta.class as any).name
                          ? (meta.class as any)()
                          : meta.class;
                      const ref = Metadata.constr(
                        obj.constructor as Constructor<any>
                      );
                      return c.name === ref.name;
                    }) || crossRelationKey;
                  return model[crossRelationKey];
                },
                ormMeta
              )(obj, prop);
            }
          );
        },
      } as any)
      .apply();

    // @manyToMany(clazz) => @ManyToMany(() => clazz)
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.MANY_TO_MANY)
      .define({
        decorator: function manyToMany(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinTableOpts?: JoinTableOptions,
          fk?: string
        ) {
          const metadata: RelationsMetadata = {
            class: clazz,
            cascade: cascade,
            populate: populate,
          };
          if (joinTableOpts) metadata.joinTable = joinTableOpts;
          if (fk) metadata.name = fk;
          const ormMeta: RelationOptions = {
            cascade:
              cascade.update === Cascade.CASCADE ||
              cascade.delete === Cascade.CASCADE,
            onDelete: cascade.delete ? "CASCADE" : "DEFAULT",
            onUpdate: cascade.update ? "CASCADE" : "DEFAULT",
            nullable: true,
            eager: populate,
          };
          return apply(
            relation(PersistenceKeys.MANY_TO_MANY, metadata),
            list(clazz),
            propMetadata(PersistenceKeys.MANY_TO_MANY, metadata),
            ManyToMany(
              () => {
                if (typeof clazz === "function" && !(clazz as any).name)
                  clazz = (clazz as any)();
                const constr = Metadata.constr(clazz as Constructor<any>);
                if (constr === clazz)
                  throw new InternalError(
                    "Original Model not found in constructor"
                  );
                return constr;
              },
              (model: any) => {
                if (typeof clazz === "function" && !(clazz as any).name)
                  clazz = (clazz as any)();
                const pk = Model.pk(clazz);
                return model[pk];
              },
              ormMeta
            ),
            JoinTable(joinTableOpts as any)
          );
        },
      } as any)
      .apply();

    // @index() => @Index()
    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.INDEX)
      .extend({
        decorator: function index(
          directions?: OrderDirection[] | string[] | string,
          compositions?: string[] | string,
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          name?: string
        ) {
          return function index(obj: any, prop: any) {
            if (typeof directions === "string") {
              name = directions;
              directions = undefined;
              compositions = undefined;
            }
            if (typeof compositions === "string") {
              name = compositions;
              compositions = undefined;
            }
            if (!compositions && directions) {
              if (
                directions.find(
                  (d) =>
                    ![OrderDirection.ASC, OrderDirection.DSC].includes(d as any)
                )
              ) {
                compositions = directions as string[];
                directions = undefined;
              }
            }

            if (compositions && compositions.length) {
              return Index([prop, ...compositions])(obj);
            }

            return Index()(obj, prop);
          };
        },
      })
      .apply();

    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.CREATED_BY)
      .define(
        onCreate(createdByOnTypeORMCreateUpdate, {}),
        required(),
        propMetadata(PersistenceKeys.CREATED_BY, {}),
        noValidateOnCreate()
      )
      .apply();

    Decoration.flavouredAs(TypeORMFlavour)
      .for(PersistenceKeys.UPDATED_BY)
      .define(
        onCreateUpdate(createdByOnTypeORMCreateUpdate, {}),
        required(),
        propMetadata(PersistenceKeys.UPDATED_BY, {}),
        noValidateOnCreateUpdate()
      )
      .apply();
  }
}
TypeORMAdapter.decoration();
Adapter.setCurrent(TypeORMFlavour);
