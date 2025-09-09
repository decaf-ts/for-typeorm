import {
  Adapter,
  Cascade,
  CascadeMetadata,
  ConnectionError,
  final,
  PersistenceKeys,
  RelationsMetadata,
  Repository,
  Sequence,
  sequenceNameForModel,
  type SequenceOptions,
  JoinTableOptions,
  OrderDirection,
  JoinTableMultipleColumnsOptions,
} from "@decaf-ts/core";
import { reservedAttributes, TypeORMFlavour } from "./constants";
import {
  BaseError,
  ConflictError,
  Context,
  DBKeys,
  DEFAULT_ERROR_MESSAGES as DB_DEFAULT_ERROR_MESSAGES,
  findPrimaryKey,
  InternalError,
  NotFoundError,
  onCreate,
  onCreateUpdate,
  OperationKeys,
  readonly,
  UpdateValidationKeys,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";
import {
  type Constructor,
  date,
  Decoration,
  DEFAULT_ERROR_MESSAGES,
  list,
  MaxLengthValidatorOptions,
  MaxValidatorOptions,
  MinLengthValidatorOptions,
  MinValidatorOptions,
  Model,
  ModelKeys,
  PatternValidatorOptions,
  prop,
  propMetadata,
  required,
  type,
  TypeMetadata,
  Validation,
  ValidationKeys,
  ValidatorOptions,
} from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { TypeORMStatement } from "./query";
import { TypeORMSequence } from "./sequences";
import { generateIndexes } from "./indexes";
import { TypeORMFlags, TypeORMQuery, TypeORMTableSpec } from "./types";
import { apply, Reflection } from "@decaf-ts/reflection";
import { TypeORMRepository } from "./TypeORMRepository";
import { Logging } from "@decaf-ts/logging";
import { TypeORMDispatch } from "./TypeORMDispatch";
import { convertJsRegexToPostgres, splitEagerRelations } from "./utils";
import {
  DataSource,
  FindOneOptions,
  In,
  InsertResult,
  RelationOptions,
  JoinColumn,
  SelectQueryBuilder,
  VersionColumn,
  JoinTable,
  ColumnType,
  ColumnOptions,
  Index,
  JoinColumnOptions,
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
import { assign, Metadata, property } from "./decorators";

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
  TypeORMQuery,
  TypeORMFlags,
  Context<TypeORMFlags>
> {
  private _dataSource?: DataSource;

  get dataSource(): DataSource {
    if (!this._dataSource) {
      const models = Adapter.models(this.flavour);
      this._dataSource = new DataSource(
        Object.assign(this.native, {
          entities: models.map((c) => c[ModelKeys.ANCHOR as keyof typeof c]),
        })
      );
    }
    return this._dataSource;
  }
  // protected dataSou

  constructor(options: DataSourceOptions, alias?: string) {
    super(options, TypeORMFlavour, alias);
  }

  protected override async flags<M extends Model>(
    operation: OperationKeys,
    model: Constructor<M>,
    flags: Partial<TypeORMFlags>
  ): Promise<TypeORMFlags> {
    const f = await super.flags(operation, model, flags);
    const newObj: any = {
      user: (await TypeORMAdapter.getCurrentUser(this.dataSource)) as string,
    };
    const m = new model();

    const exceptions: string[] = [];
    if (operation === OperationKeys.CREATE) {
      const pk = findPrimaryKey(m).id;
      exceptions.push(pk as string);
    }

    if (
      operation === OperationKeys.CREATE ||
      operation === OperationKeys.UPDATE
    ) {
      const decs = Object.keys(m).reduce((accum: Record<string, any>, key) => {
        const decs = Reflection.getPropertyDecorators(
          ValidationKeys.REFLECT,
          m,
          key,
          true
        );
        const dec = decs.decorators.find(
          (dec: any) =>
            dec.key === DBKeys.TIMESTAMP &&
            dec.props.operation.indexOf(operation) !== -1
        );
        if (dec) {
          accum[key] = dec.props;
        }
        return accum;
      }, {});

      exceptions.push(...Object.keys(decs));
    }

    newObj.ignoredValidationProperties = (
      f.ignoredValidationProperties ? f.ignoredValidationProperties : []
    ).concat(...exceptions);
    return Object.assign(f, newObj) as TypeORMFlags;
  }

  @final()
  protected override Dispatch(): TypeORMDispatch {
    return new TypeORMDispatch();
  }

  @final()
  override repository<M extends Model>(): Constructor<TypeORMRepository<M>> {
    return TypeORMRepository;
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
  async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new TypeORMSequence(options, this);
  }

  /**
   * @description Initializes the adapter by creating indexes for all managed models
   * @summary Sets up the necessary database indexes for all models managed by this adapter
   * @return {Promise<void>} A promise that resolves when initialization is complete
   */
  async initialize(): Promise<void> {
    const ds = this.dataSource;
    try {
      await ds.initialize();
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    const log = this.log.for(this.initialize);
    log.verbose(`${this.flavour} adapter initialized`);
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
      await this.dataSource.query("BEGIN");

      for (const index of indexes) {
        await this.dataSource.query(index.query, index.values);
      }

      await this.dataSource.query("COMMIT");
    } catch (e: unknown) {
      await this.dataSource.query("ROLLBACK");
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
  override async raw<R>(q: TypeORMQuery): Promise<R> {
    const log = this.log.for(this.raw);
    try {
      if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    try {
      const { query, values } = q;
      log.debug(
        `executing query: ${(query as unknown as SelectQueryBuilder<any>).getSql()}`
      );
      const response = await this.dataSource.query(query, values);
      return response as R;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override prepare<M extends Model>(
    model: M,
    pk: keyof M,
    child = false
  ): {
    record: Record<string, any>;
    id: string;
    transient?: Record<string, any>;
  } {
    const prepared = super.prepare(model, pk);

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
          value = this.prepare(value, findPrimaryKey(value).id, true).record;
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
      ? new (constr as any)[ModelKeys.ANCHOR as keyof typeof constr]()
      : new constr();
    if (child)
      Object.defineProperty(result, "constructor", {
        configurable: false,
        enumerable: false,
        value: (constr as any)[ModelKeys.ANCHOR as keyof typeof constr],
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
    clazz: string | Constructor<M>,
    pk: keyof M,
    id: string | number | bigint,
    transient?: Record<string, any>
  ): M {
    const log = this.log.for(this.revert);
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
  override async create(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>> {
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    const repo = this.dataSource.getRepository(m);
    if (typeof id !== "undefined") {
      const existing = await repo.findOne({
        where: {
          [pk]: id,
        },
      });
      if (existing) {
        throw new ConflictError(
          `Record already exists in table ${Repository.table(m)} with id: ${id}`
        );
      }
    }
    try {
      return await repo.save(model);
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
  override async read(
    tableName: string,
    id: string | number,
    pk: string
  ): Promise<Record<string, any>> {
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    let result: any;
    try {
      const repo = this.dataSource.getRepository(m);
      const { nonEager, relations } = splitEagerRelations(m);

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
  override async update(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>> {
    await this.read(tableName, id, pk);
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    try {
      const repo = this.dataSource.getRepository(m);
      return repo.save(model);
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
  override async delete(
    tableName: string,
    id: string | number,
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>> {
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    const model = await this.read(tableName, id, pk);
    try {
      const repo = this.dataSource.getRepository(m);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const res = await repo.delete(id);
      return model;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override async createAll(
    tableName: string,
    id: (string | number)[],
    model: Record<string, any>[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    try {
      const repo = this.dataSource.getRepository(m);
      const result: InsertResult = await repo.insert(model);
      return this.readAll(
        tableName,
        result.identifiers.map((id) => id.id),
        "id"
      );
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override async readAll(
    tableName: string,
    id: (string | number | bigint)[],
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    if (!id.length) return [];

    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    try {
      const repo = this.dataSource.getRepository(m);
      return repo.findBy({ [pk]: In(id) });
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override async updateAll(
    tableName: string,
    ids: string[] | number[],
    model: Record<string, any>[],
    pk: string,
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    const result = [];
    for (const m of model) {
      result.push(await this.update(tableName, m[pk], m, pk, ...args));
    }
    return result;
  }

  override async deleteAll(
    tableName: string,
    ids: (string | number | bigint)[],
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    if (!ids.length) return [];
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    try {
      const repo = this.dataSource.getRepository(m);
      const models = await this.readAll(tableName, ids, pk);
      await repo.delete(ids);
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
  parseError(err: Error | string, reason?: string): BaseError {
    return TypeORMAdapter.parseError(err, reason);
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
  protected static parseError(err: Error | string, reason?: string): BaseError {
    if (err instanceof BaseError) return err as any;
    const code: string = typeof err === "string" ? err : err.message;

    if (code.match(/duplicate key|already exists/g))
      return new ConflictError(code);
    if (code.match(/does not exist|not found|Could not find/g))
      return new NotFoundError(code);

    // PostgreSQL error codes: https://www.postgresql.org/docs/current/errcodes-appendix.html
    switch (code.toString()) {
      // Integrity constraint violations
      case "23505": // unique_violation
      case "23503": // foreign_key_violation
      case "42P07": // duplicate_table
        return new ConflictError(reason as string);

      // Object not found errors
      case "42P01": // undefined_table
      case "42703": // undefined_column
        return new NotFoundError(reason as string);

      // Invalid object definition
      case "42P16": // invalid_table_definition
        return new IndexError(err);

      // Connection errors
      default:
        if (code.toString().match(/ECONNREFUSED/g))
          return new ConnectionError(err);
        return new InternalError(err);
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
          const mm = new m();
          const type = Reflection.getTypeFromDecorator(
            mm,
            findPrimaryKey(mm).id
          );
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
    const tableName = Repository.table(clazz);
    const { cascade } = options;
    const cascadeStr = `${cascade.update ? " ON UPDATE CASCADE" : ""}${cascade.delete ? " ON DELETE CASCADE" : ""}`;
    switch (`relations${key}`) {
      case PersistenceKeys.ONE_TO_ONE:
        return `FOREIGN KEY (${prop}) REFERENCES ${tableName}(${pk})${cascadeStr}`;
      default:
        throw new InternalError(`Unsupported operation: ${key}`);
    }
  }

  static async createTable<M extends Model>(
    client: DataSource,
    model: Constructor<M>
  ): Promise<Record<string, TypeORMTableSpec>> {
    const result: Record<string, TypeORMTableSpec> = {};
    const m = new model({});
    const tableName = Repository.table(model);
    const { id } = findPrimaryKey(m);

    let isPk: boolean, column: string;
    const properties = Object.getOwnPropertyNames(m) as (keyof M)[];
    for (const prop of properties) {
      if (
        typeof (this as any)[prop] === "function" ||
        prop.toString().startsWith("_") ||
        prop === "constructor"
      ) {
        continue;
      }

      isPk = prop === id;
      column = Repository.column(m, prop.toString());

      const allDecs = Reflection.getPropertyDecorators(
        ValidationKeys.REFLECT,
        m,
        prop.toString(),
        false,
        true
      );

      const decoratorData = allDecs.decorators.reduce(
        (accum: Record<string, any>, el) => {
          const { key, props } = el;
          if (key === ModelKeys.TYPE && !accum[ValidationKeys.TYPE]) {
            accum[ValidationKeys.TYPE] = {
              customTypes: [props.name as string],
              message: DEFAULT_ERROR_MESSAGES.TYPE,
              description: "defines the accepted types for the attribute",
            };
          } else if (key !== ValidationKeys.TYPE) {
            // do nothing. we can only support basis ctypes at this time
            accum[key] = props;
          }
          return accum;
        },
        {}
      );

      const dbDecs = Reflection.getPropertyDecorators(
        Repository.key("relations"),
        m,
        prop.toString(),
        true,
        true
      );

      const query: string[] = [];
      const constraints: string[] = [];
      const foreignKeys: string[] = [];
      let typeData: TypeMetadata | undefined = undefined;
      let childClass: Constructor<Model> | undefined = undefined;
      let childPk: any;

      if (Object.keys(decoratorData).length) {
        typeData = decoratorData[ValidationKeys.TYPE] as TypeMetadata;

        if (!typeData) {
          throw new Error(`Missing type information`);
        }

        let parsedType:
          | string
          | { model: Constructor<Model> | string; pkType?: string } =
          this.parseTypeToPostgres(
            typeof (typeData.customTypes as any[])[0] === "function"
              ? (typeData.customTypes as any)[0]()
              : (typeData.customTypes as any)[0],
            isPk
          );
        if (typeof parsedType === "string") {
          parsedType = { model: parsedType };
        }
        let typeStr:
          | string
          | { model: Constructor<Model> | string; pkType?: string } =
          parsedType.model as
            | string
            | { model: Constructor<Model> | string; pkType?: string };

        if (typeof typeStr !== "string") {
          if (Array.isArray(typeStr)) {
            console.log(typeStr);
          }

          // continue;
          // const res: Record<string, PostgresTableSpec> = await this.createTable(pool, typeStr);
          try {
            childClass = parsedType.model as Constructor<Model>;
            const m = new childClass();
            childPk = findPrimaryKey(m);
            typeStr = this.parseTypeToPostgres(
              parsedType.pkType as string,
              false,
              true
            );
            await this.createTable(client, childClass);
          } catch (e: unknown) {
            if (!(e instanceof ConflictError)) throw e;
          }
        }

        let tp = Array.isArray(typeData.customTypes)
          ? typeData.customTypes[0]
          : typeData.customTypes;
        tp = typeof tp === "function" && !tp.name ? tp() : tp;
        const validationStr = this.parseValidationToPostgres(
          column,
          tp as any,
          isPk,
          ValidationKeys.MAX_LENGTH,
          (decoratorData[
            ValidationKeys.MAX_LENGTH
          ] as MaxLengthValidatorOptions) || {
            [ValidationKeys.MAX_LENGTH]: 255,
          }
        );

        const q = `${column} ${typeStr}${validationStr}`;

        if (isPk) {
          query.unshift(q);
        } else {
          query.push(q);
        }

        for (const [key, props] of Object.entries(decoratorData).filter(
          ([k]) =>
            ![ValidationKeys.TYPE, ValidationKeys.MAX_LENGTH].includes(k as any)
        )) {
          const validation = this.parseValidationToPostgres(
            column,
            tp as any,
            isPk,
            key,
            props
          );
          if (validation.startsWith("CONSTRAINT")) {
            constraints.push(validation);
          } else {
            if (validation) {
              query.push(validation);
            }
          }
        }
      }

      // TODO ignore for now. this leaves foreign keys out
      // eslint-disable-next-line no-constant-binary-expression
      if (false || (dbDecs && dbDecs.decorators.length)) {
        if (!typeData) throw new Error(`Missing type information`);
        for (const decorator of dbDecs.decorators) {
          const { key, props } = decorator;
          const validation = this.parseRelationsToPostgres(
            column,
            childClass as Constructor<Model>,
            childPk.id,
            key as PersistenceKeys,
            props as unknown as RelationsMetadata
          );
          if (validation.startsWith("FOREIGN")) {
            foreignKeys.push(validation);
          } else {
            throw new InternalError(`Unsupported relation: ${key}`);
          }
        }
      }

      result[prop.toString()] = {
        query: query.join(" "),
        values: [],
        primaryKey: isPk,
        constraints: constraints,
        foreignKeys: foreignKeys,
      };
    }

    const values = Object.values(result);
    const query = values.map((r) => r.query).join(",\n");
    const constraints = values
      .filter((c) => !!c.constraints.length)
      .map((r) => r.constraints)
      .join(",\n");
    const foreignKeys = values
      .filter((c) => !!c.foreignKeys.length)
      .map((r) => r.foreignKeys)
      .join(",\n");
    const vals = [query, constraints];
    if (foreignKeys) {
      vals.push(foreignKeys);
    }
    const queryString = `CREATE TABLE ${tableName} (${vals.filter((v) => !!v).join(",\n")})`;
    try {
      await client.query(queryString);
      await client.query(
        `CREATE TRIGGER notify_changes_${tableName}
AFTER INSERT OR UPDATE OR DELETE ON ${tableName}
    FOR EACH ROW
    EXECUTE FUNCTION notify_table_changes();`
      );
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    return result;
  }

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

    // @table() => @Entity()
    const tableKey = Adapter.key(PersistenceKeys.TABLE);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(tableKey)
      .extend((original: any) =>
        Entity()(original[ModelKeys.ANCHOR] || original)
      )
      .apply();

    // @pk() => @PrimaryGeneratedColumn() | @PrimaryColumn()
    const pkKey = Repository.key(DBKeys.ID);

    function pkDec(options: SequenceOptions) {
      return function pkDec(original: any, prop: any) {
        const decorators: any[] = [
          required(),
          readonly(),
          propMetadata(pkKey, options),
          assign(`pk.${prop}`, options),
        ];
        let type =
          options.type || Reflection.getTypeFromDecorator(original, prop);
        if (!type)
          throw new InternalError(
            `Missing type information for property ${prop} of ${original.name}`
          );
        if (options.generated) {
          const name = options.name || sequenceNameForModel(original, "pk");
          decorators.push(
            PrimaryGeneratedColumn({
              name: name,
            })
          );
        } else {
          switch (type.toLowerCase()) {
            case "number":
              type = "numeric";
              break;
            case "string":
              type = "varchar";
              break;
            case "bigint":
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
        return apply(...decorators)(original, prop);
      };
    }

    Decoration.flavouredAs(TypeORMFlavour)
      .for(pkKey)
      .define({
        decorator: pkDec,
      })
      .apply();

    Decoration.flavouredAs(TypeORMFlavour)
      .for(ModelKeys.ATTRIBUTE)
      .extend(property())
      .apply();

    // @column("columnName") => @Column({name: "columnName"})
    const columnKey = Adapter.key(PersistenceKeys.COLUMN);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(columnKey)
      .extend({
        decorator: function columm(name: string) {
          return function column(obj: any, prop: any) {
            const opts: ColumnOptions = {};
            if (name) opts.name = name;
            const pk = Metadata.get(obj, "pk");
            if (pk !== prop) {
              opts.nullable = true;
            }
            return Column(opts)(obj, prop);
          };
        },
        transform: (args: any[]) => {
          const columnName = args[1];
          return [columnName];
        },
      })
      .apply();

    // @unique => @Column({unique: true})
    const uniqueKey = Adapter.key(PersistenceKeys.UNIQUE);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(uniqueKey)
      .define(propMetadata(uniqueKey, {}))
      .extend(Column({ unique: true }))
      .apply();

    // @required => @Column({ nullable: false })
    const requiredKey = Validation.key(ValidationKeys.REQUIRED);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(requiredKey)
      .extend(Column({ nullable: false }))
      .apply();

    // @version => @VersionColumn()
    const versionKey = Repository.key(DBKeys.VERSION);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(versionKey)
      .define(type(Number.name), VersionColumn())
      .apply();

    function ValidationUpdateKey(key: string) {
      return UpdateValidationKeys.REFLECT + key;
    }

    // @timestamp(op) => @CreateDateColumn() || @UpdateDateColumn()
    const timestampKey = ValidationUpdateKey(DBKeys.TIMESTAMP);

    function ts(operation: OperationKeys[], format: string) {
      const decorators: any[] = [
        date(format, DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.DATE),
        required(DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.REQUIRED),
        propMetadata(Validation.key(DBKeys.TIMESTAMP), {
          operation: operation,
          format: format,
        }),
      ];
      if (operation.indexOf(OperationKeys.UPDATE) !== -1)
        decorators.push(
          propMetadata(timestampKey, {
            message: DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.INVALID,
          })
        );
      else decorators.push(readonly());
      return apply(...decorators);
    }

    Decoration.flavouredAs(TypeORMFlavour)
      .for(timestampKey)
      .define({
        decorator: ts,
      })
      .extend({
        decorator: function timestamp(...ops: OperationKeys[]) {
          return function timestamp(obj: any, prop: any) {
            if (ops.indexOf(OperationKeys.UPDATE) !== -1)
              return UpdateDateColumn()(obj, prop);
            return CreateDateColumn()(obj, prop);
          };
        },
        transform: (args: any[]) => {
          return args[0];
        },
      })
      .apply();

    // @oneToOne(clazz) => @OneToOne(() => clazz)
    const oneToOneKey = Repository.key(PersistenceKeys.ONE_TO_ONE);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(oneToOneKey)
      .define({
        decorator: function oneToOne(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinColumnOpts?: JoinColumnOptions,
          fk?: string
        ) {
          const metadata: RelationsMetadata = {
            class: clazz.name ? clazz.name : (clazz as any),
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
            prop(PersistenceKeys.RELATIONS),
            type([
              (typeof clazz === "function" && !clazz.name
                ? clazz
                : clazz.name) as any,
              String.name,
              Number.name,
              BigInt.name,
            ]),
            propMetadata(oneToOneKey, metadata),
            OneToOne(
              () => {
                if (!clazz.name) clazz = (clazz as any)();
                if (!clazz[ModelKeys.ANCHOR as keyof typeof clazz])
                  throw new InternalError(
                    "Original Model not found in constructor"
                  );
                return clazz[ModelKeys.ANCHOR as keyof typeof clazz];
              },
              (model: any) => {
                const pk = findPrimaryKey(new (clazz as Constructor<any>)()).id;
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
      })
      .apply();

    // @oneToMany(clazz) => @OneToMany(() => clazz)
    const oneToManyKey = Repository.key(PersistenceKeys.ONE_TO_MANY);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(oneToManyKey)
      .define({
        decorator: function oneToMany(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinTableOpts?: JoinTableOptions | JoinTableMultipleColumnsOptions,
          fk?: string
        ) {
          const meta: RelationsMetadata = {
            class: clazz.name ? clazz.name : (clazz as any),
            cascade: cascade,
            populate: populate,
          };
          if (joinTableOpts) meta.joinTable = joinTableOpts;
          if (fk) meta.name = fk;

          const decorators = [
            prop(PersistenceKeys.RELATIONS),
            list(clazz),
            propMetadata(oneToManyKey, meta),
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
                  if (!clazz.name) clazz = (clazz as any)();
                  if (!clazz[ModelKeys.ANCHOR as keyof typeof clazz])
                    throw new InternalError(
                      "Original Model not found in constructor"
                    );
                  return clazz[ModelKeys.ANCHOR as keyof typeof clazz];
                },
                (model: any) => {
                  if (!clazz.name) clazz = (clazz as any)();
                  const m = new (clazz as Constructor<any>)();
                  const crossRelationKey = Object.keys(m).find((k) => {
                    const decs = Reflection.getPropertyDecorators(
                      Repository.key(PersistenceKeys.MANY_TO_ONE),
                      m,
                      k,
                      true
                    );
                    if (!decs || !decs.decorators || !decs.decorators.length)
                      return false;
                    const dec = decs.decorators[0];
                    const clazz =
                      typeof dec.props.class === "function" &&
                      !dec.props.class.name
                        ? dec.props.class()
                        : dec.props.class;
                    return clazz.name === obj.constructor.name;
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
      })
      .apply();

    // @manyToOne(clazz) => @ManyToOne(() => clazz)
    const manyToOneKey = Repository.key(PersistenceKeys.MANY_TO_ONE);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(manyToOneKey)
      .define({
        decorator: function manyToOne(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinTableOpts?: JoinTableOptions | JoinTableMultipleColumnsOptions,
          fk?: string
        ) {
          const metadata: RelationsMetadata = {
            class: (clazz.name ? clazz.name : clazz) as string,
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
            prop(PersistenceKeys.RELATIONS),
            type([
              (typeof clazz === "function" && !clazz.name
                ? clazz
                : clazz.name) as any,
              String.name,
              Number.name,
              BigInt.name,
            ]),
            propMetadata(manyToOneKey, metadata),
            function ManyToOneWrapper(obj: any, prop: any): any {
              return ManyToOne(
                () => {
                  if (!clazz.name) clazz = (clazz as any)();
                  if (!clazz[ModelKeys.ANCHOR as keyof typeof clazz])
                    throw new InternalError(
                      "Original Model not found in constructor"
                    );
                  return clazz[ModelKeys.ANCHOR as keyof typeof clazz];
                },
                (model: any) => {
                  if (!clazz.name) clazz = (clazz as any)();
                  const m = new (clazz as Constructor<any>)();
                  let crossRelationKey = Object.keys(m).find((k) => {
                    const decs = Reflection.getPropertyDecorators(
                      Repository.key(PersistenceKeys.ONE_TO_MANY),
                      m,
                      k,
                      true
                    );
                    if (!decs || !decs.decorators || !decs.decorators.length)
                      return false;
                    const listDec = Reflect.getMetadata(
                      Validation.key(ValidationKeys.LIST),
                      m,
                      k
                    );
                    if (!listDec)
                      throw new InternalError(
                        `No Type Definition found for ${k} in ${m.constructor.name}`
                      );
                    const name = listDec.clazz[0]().name;
                    return name === obj.constructor.name;
                  });
                  if (!crossRelationKey)
                    crossRelationKey = findPrimaryKey(
                      new (clazz as Constructor<any>)()
                    ).id as string;
                  return model[crossRelationKey];
                },
                ormMeta
              )(obj, prop);
            }
          );
        },
      })
      .apply();

    // @manyToMany(clazz) => @ManyToMany(() => clazz)
    const manyToManyKey = Repository.key(PersistenceKeys.MANY_TO_MANY);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(manyToManyKey)
      .define({
        decorator: function manyToMany(
          clazz: Constructor<any> | (() => Constructor<any>),
          cascade: CascadeMetadata,
          populate: boolean,
          joinTableOpts?: JoinTableOptions,
          fk?: string
        ) {
          const metadata: RelationsMetadata = {
            class: clazz.name ? clazz.name : (clazz as any),
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
            prop(PersistenceKeys.RELATIONS),
            list(clazz),
            propMetadata(manyToManyKey, metadata),
            ManyToMany(
              () => {
                if (!clazz.name) clazz = (clazz as any)();
                if (!clazz[ModelKeys.ANCHOR as keyof typeof clazz])
                  throw new InternalError(
                    "Original Model not found in constructor"
                  );
                return clazz[ModelKeys.ANCHOR as keyof typeof clazz];
              },
              (model: any) => {
                if (!clazz.name) clazz = (clazz as any)();
                const pk = findPrimaryKey(new (clazz as Constructor<any>)()).id;
                return model[pk];
              },
              ormMeta
            ),
            JoinTable(joinTableOpts as any)
          );
        },
      })
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

    const createdByKey = Repository.key(PersistenceKeys.CREATED_BY);
    const updatedByKey = Repository.key(PersistenceKeys.UPDATED_BY);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(createdByKey)
      .define(
        onCreate(createdByOnTypeORMCreateUpdate, {}),
        required(),
        propMetadata(createdByKey, {})
        // assign(`pk.${prop}`, options)
      )
      .apply();

    Decoration.flavouredAs(TypeORMFlavour)
      .for(updatedByKey)
      .define(
        onCreateUpdate(createdByOnTypeORMCreateUpdate, {}),
        required(),
        propMetadata(updatedByKey, {})
      )
      .apply();
  }
}

Adapter.setCurrent(TypeORMFlavour);
