import {
  Adapter,
  Sequence,
  type SequenceOptions,
  PersistenceKeys,
  ConnectionError,
  Repository,
} from "@decaf-ts/core";
import { PostgresFlavour, PostgresKeys, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  Context,
  DBKeys,
  findPrimaryKey,
  InternalError,
  NotFoundError,
  RepositoryFlags,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";

import {
  Constructor,
  DEFAULT_ERROR_MESSAGES,
  ListMetadata,
  MaxLengthValidatorOptions,
  MinLengthValidatorOptions,
  Model,
  ModelKeys,
  PatternValidatorOptions,
  TypeMetadata,
  ValidationKeys,
  Validator,
  ValidatorOptions,
} from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { PostgresStatement } from "./query";
import { final } from "@decaf-ts/core";
import { Pool, PoolClient, PoolConfig, QueryResult } from "pg";
import { PostgresSequence } from "./sequences";
import { generateIndexes } from "./indexes";
import { PostgresQuery } from "./types";
import { Reflection } from "@decaf-ts/reflection";

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
export class PostgresAdapter extends Adapter<
  Pool,
  PostgresQuery,
  RepositoryFlags,
  Context<RepositoryFlags>
> {
  constructor(scope: Pool, alias?: string) {
    super(scope, PostgresFlavour, alias);
  }

  /**
   * @description Creates a new Postgres statement for querying
   * @summary Factory method that creates a new PostgresStatement instance for building queries
   * @template M - The model type
   * @return {PostgresStatement<M, any>} A new PostgresStatement instance
   */
  @final()
  Statement<M extends Model>(): PostgresStatement<M, any> {
    return new PostgresStatement(this);
  }

  /**
   * @description Creates a new PostgreSQL sequence
   * @summary Factory method that creates a new PostgreSQLSequence instance for managing sequences
   * @param {SequenceOptions} options - The options for the sequence
   * @return {Promise<Sequence>} A promise that resolves to a new Sequence instance
   */
  @final()
  async Sequence(options: SequenceOptions): Promise<Sequence> {
    return new PostgresSequence(options, this);
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
  protected async index<M extends Model>(
    ...models: Constructor<M>[]
  ): Promise<void> {
    const indexes: PostgresQuery[] = generateIndexes(models);
    const client = await this.native.connect();

    try {
      await client.query("BEGIN");

      for (const index of indexes) {
        await client.query(index.query, index.values);
      }

      await client.query("COMMIT");
    } catch (e: unknown) {
      await client.query("ROLLBACK");
      throw this.parseError(e as Error);
    } finally {
      // Release the client back to the pool
      client.release();
    }
  }

  /**
   * @description Executes a raw SQL query against the database
   * @summary Abstract method that must be implemented to execute raw SQL queries
   * @template R - The result type
   * @param {PostgresQuery} q - The query to execute
   * @param {boolean} rowsOnly - Whether to return only the rows or the full response
   * @return {Promise<R>} A promise that resolves to the query result
   */
  override async raw<R>(q: PostgresQuery, rowsOnly: boolean): Promise<R> {
    const client: PoolClient = await this.native.connect();
    try {
      const { query, values } = q;
      const response: QueryResult = await client.query(query, values);
      if (rowsOnly) return response.rows as R;
      return response as R;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
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
    const fields: string[] = [];
    const values: any[] = [];

    Object.entries(model).forEach(([key, value]) => {
      if (key !== PersistenceKeys.METADATA && !this.isReserved(key)) {
        fields.push(key);
        values.push(value);
      }
    });

    const sql = `INSERT INTO $1 ($2}) VALUES ($3) RETURNING *`;
    const response: QueryResult = await this.raw(
      { query: sql, values: [tableName, fields.join(", "), values.join(", ")] },
      false
    );
    const { rows } = response;
    return rows[0];
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
    const sql = "SELECT * FROM $1 WHERE $2 = $3";
    const result: any = await this.raw(
      { query: sql, values: [tableName, pk, id] },
      false
    );
    if (result.rowCount === 0)
      throw new NotFoundError(
        `Record with id: ${id} not found in table ${tableName}`
      );
    return result.rows[0];
  }

  /**
   * @description Updates a record in the database
   * @summary Abstract method that must be implemented to update a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {Record<string, any>} model - The model to update
   * @param {any[]} args - Additional arguments
   * @return A promise that resolves to the updated record
   */
  override async update(
    tableName: string,
    id: string | number,
    model: Record<string, any>,
    pk: string
  ): Promise<Record<string, any>> {
    const sets: string[] = [];

    Object.entries(model).forEach(([key, value]) => {
      if (key !== PersistenceKeys.METADATA && !this.isReserved(key)) {
        sets.push(`${key} = $${value}`);
      }
    });

    const sql = `UPDATE $1 as t SET $2 WHERE t.$3 = $4 RETURNING *`;

    const response: QueryResult = await this.raw(
      { query: sql, values: [tableName, sets.join(", "), pk, id] },
      false
    );

    if (response.rowCount === 0) {
      throw new NotFoundError(
        `Record with id: ${id} not found in table ${tableName}`
      );
    }

    const { rows } = response;
    return rows[0];
  }

  /**
   * @description Deletes a record from the database
   * @summary Abstract method that must be implemented to delete a record
   * @param {string} tableName - The name of the table
   * @param {string|number} id - The ID of the record
   * @param {any[]} args - Additional arguments
   * @return A promise that resolves to the deleted record
   */
  override async delete(
    tableName: string,
    id: string | number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>> {
    const sql = `
        DELETE FROM ${tableName}
        WHERE ${PostgresKeys.ID} = $1
        RETURNING *
      `;

    const result: QueryResult = await this.raw(
      {
        query: sql,
        values: [id],
      },
      false
    );

    if (result.rowCount === 0) {
      throw new NotFoundError(
        `Record with id: ${id} not found in table ${tableName}`
      );
    }
    return result.rows[0];
  }

  /**
   * @description Parses an error and converts it to a BaseError
   * @summary Converts various error types to appropriate BaseError subtypes
   * @param {Error|string} err - The error to parse
   * @param {string} [reason] - Optional reason for the error
   * @return {BaseError} The parsed error as a BaseError
   */
  parseError(err: Error | string, reason?: string): BaseError {
    return PostgresAdapter.parseError(err, reason);
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

  static async connect(config: PoolConfig): Promise<Pool> {
    return new Pool(config);
  }

  static async createDatabase(pool: Pool, dbName: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query({
        name: `create-database`,
        text: `CREATE DATABASE ${dbName}`,
      });
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  static async deleteDatabase(pool: Pool, dbName: string): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query({
        name: `delete-database`,
        text: `DROP DATABASE ${dbName}`,
      });
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  static async createUser(
    pool: Pool,
    dbName: string,
    user: string,
    password: string
  ): Promise<void> {
    const client = await pool.connect();
    let res;
    try {
      res = await client.query(
        `CREATE USER ${user} WITH PASSWORD '${password}'`
      );
      res = await client.query(
        `GRANT CONNECT ON DATABASE ${dbName} TO ${user}`
      );

      res = await client.query(`GRANT USAGE ON SCHEMA public TO ${user}`);
      res = await client.query(`GRANT CREATE ON SCHEMA public TO ${user}`);
      res = await client.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${user}`
      );
      res = await client.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${user}`
      );
      res = await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${user}`
      );
      res = await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ${user}`
      );
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  static async deleteUser(
    pool: Pool,
    user: string,
    admin: string
  ): Promise<void> {
    const client = await pool.connect();
    let res;
    try {
      res = await client.query(`REASSIGN OWNED BY ${user} TO ${admin}`);
      res = await client.query(
        `REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${user}`
      );
      res = await client.query(`REVOKE ALL ON SCHEMA public FROM ${user}`);
      res = await client.query(
        `REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM ${user}`
      );
      res = await client.query(
        `REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public FROM ${user}`
      );
      res = await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM ${user}`
      );
      res = await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${user};`
      );
      res = await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${user}`
      );
      res = await client.query(`DROP USER IF EXISTS "${user}"`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  private static parseTypeToPostgres(type: string, isPk: boolean) {
    switch (type.toLowerCase()) {
      case "string":
        return isPk ? "TEXT PRIMARY KEY" : "VARCHAR";
      case "number":
        return isPk ? "SERIAL PRIMARY KEY" : "SERIAL";
      case "boolean":
        return "BOOLEAN";
      case "date":
        return "DATE";
      case "bigint":
        return isPk ? "BIGINT PRIMARY KEY" : "BIGINT";
      default:
        throw new InternalError(`Unsupported type: ${type}`);
    }
  }

  private static parseValidationToPostgres(
    prop: string,
    type: string,
    key: string,
    options: ValidatorOptions
  ) {
    switch (key) {
      case ValidationKeys.REQUIRED:
        return "NOT NULL";
      case ValidationKeys.MAX_LENGTH:
        if (!options || type.toLowerCase() !== "string") return "";
        return `(${(options as MaxLengthValidatorOptions)[ValidationKeys.MAX_LENGTH]})`;
      case ValidationKeys.MIN_LENGTH:
        return `CONSTRAINT ${prop}_min_length_check CHECK (LENGTH(${prop}) = ${(options as MinLengthValidatorOptions)[ValidationKeys.MIN_LENGTH]})`;
      case ValidationKeys.PATTERN:
      case ValidationKeys.URL:
      case ValidationKeys.EMAIL:
        return `CONSTRAINT ${prop}_pattern_check CHECK (${prop} ~ '${(options as PatternValidatorOptions)[ValidationKeys.PATTERN]}')`;
      case ValidationKeys.TYPE:
      case ValidationKeys.DATE:
        return "";
      case ValidationKeys.PASSWORD:
      default:
        throw new InternalError(`Unsupported type: ${key}`);
    }
  }

  private static parseRelationsToPostgres(
    prop: string,
    type: string,
    key: string,
    options: ValidatorOptions
  ) {
    switch (key) {
      case ValidationKeys.REQUIRED:
        return "NOT NULL";
      case ValidationKeys.MAX_LENGTH:
        if (type === "string" && options) {
          return `(${(options as MaxLengthValidatorOptions)[ValidationKeys.MAX_LENGTH]})`;
        }
        return "";
      case ValidationKeys.MIN_LENGTH:
        return `CONSTRAINT ${prop}_min_length_check CHECK (LENGTH(${prop}) = ${(options as MinLengthValidatorOptions)[ValidationKeys.MIN_LENGTH]})`;
      case ValidationKeys.PATTERN:
      case ValidationKeys.URL:
      case ValidationKeys.EMAIL:
        return `CONSTRAINT locale_pattern_check CHECK (locale ~ '${(options as PatternValidatorOptions)[ValidationKeys.PATTERN]}')`;
      case ValidationKeys.PASSWORD:
      case ValidationKeys.TYPE:
        return "";
      default:
        throw new InternalError(`Unsupported type: ${key}`);
    }
  }

  static async createTable<M extends Model>(pool: Pool, model: Constructor<M>) {
    const result: { [key: string]: PostgresQuery & { constraints: string[] } } =
      {};
    const m = new model();
    const tableName = Repository.table(model);
    const { id, props } = findPrimaryKey(m);

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

      if (!Object.keys(decoratorData).length) {
        continue;
      }

      const query: string[] = [];
      const constraints: string[] = [];

      const typeData: TypeMetadata = decoratorData[
        ValidationKeys.TYPE
      ] as TypeMetadata;

      if (!typeData) {
        throw new Error(`Missing type information`);
      }

      query.push(
        `${column} ${this.parseTypeToPostgres(typeData.customTypes[0], isPk)}${this.parseValidationToPostgres(
          column,
          typeData.customTypes[0],
          ValidationKeys.MAX_LENGTH,
          (decoratorData[
            ValidationKeys.MAX_LENGTH
          ] as MaxLengthValidatorOptions) || {
            [ValidationKeys.MAX_LENGTH]: 255,
          }
        )}`
      );

      for (const [key, props] of Object.entries(decoratorData).filter(
        ([k]) => ![ValidationKeys.TYPE, ValidationKeys.MAX_LENGTH].includes(k)
      )) {
        const validation = this.parseValidationToPostgres(
          column,
          typeData.customTypes[0],
          key,
          props
        );
        if (validation.startsWith("CONSTRAINT")) {
          constraints.push(validation);
        } else {
          if (validation) query.push(validation);
        }
      }
      // const dbDecs = Reflection.getPropertyDecorators(
      //   DBKeys.REFLECT,
      //   this,
      //   prop.toString(),
      //   true,
      //   true
      // );

      result[prop.toString()] = {
        query: query.join(" "),
        values: [],
        constraints: constraints,
      };
    }

    const client = await pool.connect();
    const values = Object.values(result);
    const query = values.map((r) => r.query).join(",\n");
    const constraints = values
      .filter((c) => !!c.constraints.length)
      .map((r) => r.constraints)
      .join(",\n");
    const queryString = `CREATE TABLE "${tableName}" (${[query, constraints].join(",\n")})`;
    try {
      await client.query({
        name: `create-table`,
        text: queryString,
      });
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }
}
