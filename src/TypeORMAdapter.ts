import {
  Adapter,
  Sequence,
  type SequenceOptions,
  PersistenceKeys,
  ConnectionError,
  Repository,
  RelationsMetadata,
  DefaultSequenceOptions,
  final,
} from "@decaf-ts/core";
import { reservedAttributes, TypeORMFlavour } from "./constants";
import {
  BaseError,
  ConflictError,
  Context,
  DBKeys,
  DEFAULT_TIMESTAMP_FORMAT,
  findPrimaryKey,
  InternalError,
  NotFoundError,
  OperationKeys,
  DEFAULT_ERROR_MESSAGES as DB_DEFAULT_ERROR_MESSAGES,
  readonly,
  UpdateValidationKeys,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";
import {
  type Constructor,
  date,
  DEFAULT_ERROR_MESSAGES,
  Decoration,
  MaxLengthValidatorOptions,
  MaxValidatorOptions,
  MinLengthValidatorOptions,
  MinValidatorOptions,
  Model,
  ModelKeys,
  PatternValidatorOptions,
  propMetadata,
  required,
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
import { Reflection } from "@decaf-ts/reflection";
import { TypeORMRepository } from "./TypeORMRepository";
import { Logging } from "@decaf-ts/logging";
import { TypeORMDispatch } from "./TypeORMDispatch";
import { convertJsRegexToPostgres } from "./utils";
import { DataSource, In, InsertResult } from "typeorm";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { Column } from "./overrides/Column";
import { UpdateDateColumn } from "./overrides/UpdateDateColumn";
import { CreateDateColumn } from "./overrides/CreateDateColumn";
import { PrimaryGeneratedColumn } from "./overrides/PrimaryGeneratedColumn";
import { Entity } from "./overrides/Entity";

export async function createdByOnPostgresCreateUpdate<
  M extends Model,
  R extends TypeORMRepository<M>,
  V extends RelationsMetadata,
>(
  this: R,
  context: Context<TypeORMFlags>,
  data: V,
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
 * @description Abstract adapter for Postgres database operations
 * @summary Provides a base implementation for Postgres database operations, including CRUD operations, sequence management, and error handling
 * @template Y - The scope type
 * @template F - The repository flags type
 * @template C - The context type
 * @param {Y} scope - The scope for the adapter
 * @param {string} flavour - The flavour of the adapter
 * @param {string} [alias] - Optional alias for the adapter
 * @class PostgresAdapter
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
      this._dataSource = new DataSource(this.native);
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
    if (operation === "create" || operation === "update") {
      const pk = findPrimaryKey(new model()).id;
      newObj.ignoredValidationProperties = (
        f.ignoredValidationProperties ? f.ignoredValidationProperties : []
      ).concat(pk as string);
    }
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
    const managedModels = Adapter.models(this.flavour);

    return this.index(...managedModels);
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
    try {
      if (!this.dataSource.isInitialized) await this.dataSource.initialize();
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    try {
      const { query, values } = q;
      const response = await this.dataSource.query(query, values);
      return response as R;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
  }

  override prepare<M extends Model>(
    model: M,
    pk: keyof M
  ): {
    record: Record<string, any>;
    id: string;
    transient?: Record<string, any>;
  } {
    const prepared = super.prepare(model, pk);

    prepared.record = Object.entries(prepared.record).reduce(
      (accum: Record<string, any>, [key, value]) => {
        if (
          key === PersistenceKeys.METADATA ||
          this.isReserved(key) ||
          key === pk
        )
          return accum;
        if (value === undefined) {
          return accum;
        }

        if (value instanceof Date) {
          value = new Date(value.getTime());
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

    return obj as M;
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>> {
    const m: Constructor<Model> = tableName as unknown as Constructor<Model>;
    try {
      const repo = this.dataSource.getRepository(m);
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
      result = (await repo.findOne({
        where: {
          [pk]: id,
        },
      })) as Record<string, any>;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    }
    if (!result)
      throw new NotFoundError(
        `Record with id: ${id} not found in table ${typeof tableName === "string" ? tableName : Repository.table(tableName)}`
      );
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
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>> {
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
    try {
      const repo = this.dataSource.getRepository(m);
      const model = await this.read(tableName, id, pk);
      await repo.delete(id);
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
      result.push(await this.update(tableName, m[pk], m, ...args));
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
    if (code.match(/does not exist|not found/g)) return new NotFoundError(code);

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
          this.parseTypeToPostgres(typeData.customTypes[0], isPk);
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

        const validationStr = this.parseValidationToPostgres(
          column,
          typeData.customTypes[0],
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
            typeData.customTypes[0],
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

  static decoration() {
    // @table() => @Entity()
    const tableKey = Adapter.key(PersistenceKeys.TABLE);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(tableKey)
      .extend((original: any) =>
        Entity()(original[ModelKeys.ANCHOR] || original)
      )
      .apply();

    // @pk => @PrimaryGeneratedColumn()
    const pkKey = Repository.key(DBKeys.ID);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(pkKey)
      .define(
        required(),
        readonly(),
        propMetadata(pkKey, DefaultSequenceOptions)
      )
      .extend((original: any, prop: any) =>
        PrimaryGeneratedColumn()(original, prop)
      )
      .apply();

    // @column("columnName") => @Column({name: "columnName"})
    const columnKey = Adapter.key(PersistenceKeys.COLUMN);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(columnKey)
      .extend({
        decorator: function columm(name: string) {
          return function column(obj: any, prop: any) {
            return Column({
              name: name || prop,
            })(obj, prop);
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

    function ValidationUpdateKey(key: string) {
      return UpdateValidationKeys.REFLECT + key;
    }

    // @timestamp(op) => @CreateDateColumn() || @UpdateDateColumn()
    const timestampKey = ValidationUpdateKey(DBKeys.TIMESTAMP);
    Decoration.flavouredAs(TypeORMFlavour)
      .for(timestampKey)
      .define(
        date(
          DEFAULT_TIMESTAMP_FORMAT,
          DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.DATE
        ),
        required(DB_DEFAULT_ERROR_MESSAGES.TIMESTAMP.REQUIRED)
      )
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
  }
}
