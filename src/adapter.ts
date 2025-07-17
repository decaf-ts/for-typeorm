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
import { PostgresFlavour, reservedAttributes } from "./constants";
import {
  BaseError,
  ConflictError,
  Context,
  DBKeys,
  findPrimaryKey,
  InternalError,
  NotFoundError,
  onCreate,
  OperationKeys,
  readonly,
} from "@decaf-ts/db-decorators";
import "reflect-metadata";
import {
  type Constructor,
  Decoration,
  DEFAULT_ERROR_MESSAGES,
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
  ValidationKeys,
  ValidatorOptions,
} from "@decaf-ts/decorator-validation";
import { IndexError } from "./errors";
import { PostgresStatement } from "./query";
import { Pool, PoolClient, PoolConfig, QueryResult } from "pg";
import { PostgresSequence } from "./sequences";
import { generateIndexes } from "./indexes";
import { PostgresFlags, type PostgresQuery, PostgresTableSpec } from "./types";
import { Reflection } from "@decaf-ts/reflection";
import { PostgresRepository } from "./PostgresRepository";
import { Logging } from "@decaf-ts/logging";
import { PostgresDispatch } from "./PostgresDispatch";
import { convertJsRegexToPostgres } from "./utils";

export async function createdByOnPostgresCreateUpdate<
  M extends Model,
  R extends PostgresRepository<M>,
  V extends RelationsMetadata,
>(
  this: R,
  context: Context<PostgresFlags>,
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
export class PostgresAdapter extends Adapter<
  Pool,
  PostgresQuery,
  PostgresFlags,
  Context<PostgresFlags>
> {
  constructor(pool: Pool, alias?: string) {
    super(pool, PostgresFlavour, alias);
  }

  protected override async flags<M extends Model>(
    operation: OperationKeys,
    model: Constructor<M>,
    flags: Partial<PostgresFlags>
  ): Promise<PostgresFlags> {
    const f = await super.flags(operation, model, flags);
    const newObj: any = {
      user: (await PostgresAdapter.getCurrentUser(this.native)) as string,
    };
    if (operation === "create" || operation === "update") {
      const pk = findPrimaryKey(new model()).id;
      newObj.ignoredValidationProperties = (
        f.ignoredValidationProperties ? f.ignoredValidationProperties : []
      ).concat(pk as string);
    }
    return Object.assign(f, newObj) as PostgresFlags;
  }

  protected override Dispatch(): PostgresDispatch {
    return new PostgresDispatch();
  }

  override repository<M extends Model>(): Constructor<
    Repository<
      M,
      PostgresQuery,
      PostgresAdapter,
      PostgresFlags,
      Context<PostgresFlags>
    >
  > {
    return PostgresRepository;
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
  @final()
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

  @final()
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
    const ob: Record<string, any> = {};
    ob[pk as string] = id || obj[pk as string];
    const m = (
      typeof clazz === "string" ? Model.build(ob, clazz) : new clazz(ob)
    ) as M;
    log.silly(`Rebuilding model ${m.constructor.name} id ${id}`);
    const result = Object.keys(m).reduce((accum: M, key) => {
      (accum as Record<string, any>)[key] = obj[Repository.column(accum, key)];
      return accum;
    }, m);

    if (transient) {
      log.verbose(
        `re-adding transient properties: ${Object.keys(transient).join(", ")}`
      );
      Object.entries(transient).forEach(([key, val]) => {
        if (key in result)
          throw new InternalError(
            `Transient property ${key} already exists on model ${m.constructor.name}. should be impossible`
          );
        result[key as keyof M] = val;
      });
    }

    return result;
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
    const values = Object.values(model);
    const sql = `INSERT INTO ${tableName} (${Object.keys(model)}) VALUES (${values.map((_, i) => `$${i + 1}`)}) RETURNING *`;
    const response: QueryResult = await this.raw(
      { query: sql, values: values },
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
    const sql = `SELECT * FROM ${tableName} as t WHERE t.${pk} = $1`;
    const result: any = await this.raw({ query: sql, values: [id] }, false);
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
    const values = Object.values(model);

    const sql = `UPDATE ${tableName} 
SET ${Object.keys(model)
      .map((f, i) => `${f} = $${i + 1}`)
      .join(", ")}
WHERE id = $${values.length + 1}
RETURNING *;`;

    const response: QueryResult = await this.raw(
      { query: sql, values: [...values, id] },
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
    const sql = `
        DELETE FROM ${tableName}
        WHERE ${pk} = $1
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

  override async createAll(
    tableName: string,
    id: (string | number)[],
    model: Record<string, any>[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    const columns = Object.keys(model[0]);

    const valuePlaceholders = model
      .map(
        (_, recordIndex) =>
          `(${columns
            .map(
              (_, colIndex) => `$${recordIndex * columns.length + colIndex + 1}`
            )
            .join(", ")})`
      )
      .join(", ");

    const values = model.flatMap((record) => Object.values(record));
    const q = `INSERT INTO ${tableName} (${columns.join(", ")})
    VALUES ${valuePlaceholders}
    RETURNING *;
`;
    const result: any = await this.raw(
      {
        query: q,
        values: values,
      },
      false
    );
    return result.rows;
  }

  override async readAll(
    tableName: string,
    id: (string | number | bigint)[],
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    if (!id.length) return [];

    const sql = `
    SELECT * 
    FROM ${tableName} 
    WHERE ${pk} = ANY($1)
    ORDER BY array_position($1::${typeof id[0] === "number" ? "integer" : "text"}[], ${pk})`;

    const result: any = await this.raw(
      {
        query: sql,
        values: [id],
      },
      false
    );

    // If we didn't find all requested records, throw an error
    if (result.rows.length !== id.length) {
      const foundIds = result.rows.map((row: any) => row[pk]);
      const missingIds = id.filter((id) => !foundIds.includes(id));
      throw new NotFoundError(
        `Records with ids: ${missingIds.join(", ")} not found in table ${tableName}`
      );
    }

    return result.rows;
  }

  override async updateAll(
    tableName: string,
    ids: string[] | number[],
    model: Record<string, any>[],
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    if (!ids.length) return [];
    if (ids.length !== model.length) {
      throw new InternalError("Number of IDs must match number of records");
    }
    // Create values array and get column names from first record
    const columns = Object.keys(model[0]);
    const values: any[] = [];
    let placeholderIndex = 1;

    // Generate value lists for each record
    const valueLists = model
      .map((record, i) => {
        const recordValues = columns.map((col) => {
          values.push(record[col]);
          if (record[col] instanceof Date) {
            return `$${placeholderIndex++}::timestamp`;
          }
          return `$${placeholderIndex++}`;
        });
        return `(${ids[i]}, ${recordValues.join(", ")})`;
      })
      .join(", ");

    const sql = `
    UPDATE ${tableName} AS t SET
      ${columns.map((col) => `${col} = c.${col}`).join(",\n      ")}
    FROM (VALUES ${valueLists}) AS c(id, ${columns.join(", ")})
    WHERE t.${pk} = c.id
    RETURNING *`;

    const result: any = await this.raw(
      {
        query: sql,
        values,
      },
      false
    );

    // Verify all records were updated
    if (result.rows.length !== ids.length) {
      const foundIds = result.rows.map((row: any) => row[pk]);
      const missingIds = ids.filter((id) => !foundIds.includes(id));
      throw new NotFoundError(
        `Records with ids: ${missingIds.join(", ")} not found in table ${tableName}`
      );
    }

    // Return updated records in the same order as input
    return ids.map((id) =>
      result.rows.find((row: any) => row[pk].toString() === id.toString())
    );
  }

  override async deleteAll(
    tableName: string,
    ids: (string | number | bigint)[],
    pk: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    ...args: any[]
  ): Promise<Record<string, any>[]> {
    if (!ids.length) return [];

    // First fetch the records that will be deleted (for returning them later)
    const fetchSql = `
    SELECT * 
    FROM ${tableName} 
    WHERE ${pk} = ANY($1)
    ORDER BY array_position($1::${typeof ids[0] === "number" ? "integer" : "text"}[], ${pk})`;

    const fetchResult: any = await this.raw(
      {
        query: fetchSql,
        values: [ids],
      },
      false
    );

    if (fetchResult.rows.length !== ids.length) {
      const foundIds = fetchResult.rows.map((row: any) => row[pk]);
      const missingIds = ids.filter((id) => !foundIds.includes(id));
      throw new NotFoundError(
        `Records with ids: ${missingIds.join(", ")} not found in table ${tableName}`
      );
    }

    const deleteSql = `
    DELETE FROM ${tableName} 
    WHERE ${pk} = ANY($1)`;

    await this.raw(
      {
        query: deleteSql,
        values: [ids],
      },
      false
    );

    return ids.map((id) =>
      fetchResult.rows.find((row: any) => row[pk].toString() === id.toString())
    );
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
    const log = Logging.for(this.createDatabase);
    log.verbose(`Creating database ${dbName}`);
    const client = await pool.connect();
    try {
      await client.query({
        name: `create-database`,
        text: `CREATE DATABASE ${dbName}`,
      });
      log.info(`Created database ${dbName}`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  static async createNotifyFunction(pool: Pool, user: string): Promise<void> {
    const log = Logging.for(this.createNotifyFunction);
    log.verbose(`Creating notify function`);
    const client = await pool.connect();
    try {
      await client.query(
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
      await client.query(
        `ALTER FUNCTION notify_table_changes() OWNER TO ${user};`
      );
      await client.query(`
            GRANT EXECUTE ON FUNCTION notify_table_changes() TO public;
        `);
      log.info(`Created notify function`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  static async deleteDatabase(
    pool: Pool,
    dbName: string,
    user?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      if (user)
        await client.query({
          name: `delete-owned-by`,
          text: `DROP OWNED BY ${user} CASCADE;`,
        });
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
    try {
      await client.query(`CREATE USER ${user} WITH PASSWORD '${password}'`);
      await client.query(`GRANT CONNECT ON DATABASE ${dbName} TO ${user}`);

      await client.query(`GRANT USAGE ON SCHEMA public TO ${user}`);
      await client.query(`GRANT CREATE ON SCHEMA public TO ${user}`);
      await client.query(
        `GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ${user}`
      );
      await client.query(
        `GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ${user}`
      );
      await client.query(
        `GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO ${user}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ${user}`
      );
      await client.query(
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
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM ${user}`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM ${user};`
      );
      await client.query(
        `ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM ${user}`
      );
      await client.query(`DROP OWNED BY ${user} CASCADE`);
      await client.query(`DROP USER IF EXISTS "${user}"`);
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
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
    pool: Pool,
    model: Constructor<M>
  ): Promise<Record<string, PostgresTableSpec>> {
    const result: Record<string, PostgresTableSpec> = {};
    const m = new model();
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
            await this.createTable(pool, childClass);
          } catch (e: unknown) {
            throw new InternalError(
              `Error creating table for ${typeStr}: ${e}`
            );
          }

          // const tbl = Repository.table(typeStr);
          // foreignKeys.push(`FOREIGN KEY (${prop as string}) REFERENCES ${tbl}(${pk as string})`);
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

      if (dbDecs && dbDecs.decorators.length) {
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

    const client = await pool.connect();
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
    } finally {
      client.release();
    }
    return result;
  }

  static async getCurrentUser(pool: Pool): Promise<string> {
    const client = await pool.connect();
    const queryString = `SELECT CURRENT_USER;`;
    try {
      const result = await client.query({
        name: `get-current-user`,
        text: queryString,
      });
      return result.rows[0].current_user;
    } catch (e: unknown) {
      throw this.parseError(e as Error);
    } finally {
      client.release();
    }
  }

  static decoration() {
    const createdByKey = Repository.key(PersistenceKeys.CREATED_BY);
    const updatedByKey = Repository.key(PersistenceKeys.UPDATED_BY);
    const pkKey = Repository.key(DBKeys.ID);
    const uniqueKey = Repository.key(DBKeys.UNIQUE);

    Decoration.flavouredAs(PostgresFlavour)
      .for(pkKey)
      .define(
        required(),
        readonly(),
        propMetadata(pkKey, DefaultSequenceOptions)
      )
      .apply();

    Decoration.flavouredAs(PostgresFlavour)
      .for(uniqueKey)
      .define(propMetadata(uniqueKey, {}))
      .apply();

    Decoration.flavouredAs(PostgresFlavour)
      .for(createdByKey)
      .define(
        onCreate(createdByOnPostgresCreateUpdate),
        propMetadata(createdByKey, {})
      )
      .apply();

    Decoration.flavouredAs(PostgresFlavour)
      .for(updatedByKey)
      .define(
        onCreate(createdByOnPostgresCreateUpdate),
        propMetadata(updatedByKey, {})
      )
      .apply();
  }
}
