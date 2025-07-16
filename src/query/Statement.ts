import {
  Condition,
  GroupOperator,
  Operator,
  OrderDirection,
  Paginator,
  Repository,
  Sequence,
  Statement,
} from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { translateOperators } from "./translate";
import { PostgreSQLQueryLimit } from "./constants";
import { PostgresPaginator } from "./Paginator";
import { findPrimaryKey, InternalError } from "@decaf-ts/db-decorators";
import { PostgresQuery } from "../types";
import { PostgresAdapter } from "../adapter";

/**
 * @description Statement builder for PostgreSQL queries
 * @summary Provides a fluent interface for building PostgreSQL queries with type safety
 * @template M - The model type that extends Model
 * @template R - The result type
 * @param adapter - The PostgreSQL adapter
 * @class PostgresStatement
 * @example
 * // Example of using PostgreSQLStatement
 * const adapter = new MyPostgreSQLAdapter(pool);
 * const statement = new PostgreSQLStatement<User, User[]>(adapter);
 *
 * // Build a query
 * const users = await statement
 *   .from(User)
 *   .where(Condition.attribute<User>('age').gt(18))
 *   .orderBy('lastName', 'asc')
 *   .limit(10)
 *   .execute();
 */
export class PostgresStatement<M extends Model, R> extends Statement<
  PostgresQuery,
  M,
  R
> {
  constructor(adapter: PostgresAdapter) {
    super(adapter);
  }

  /**
   * @description Builds a PostgreSQL query from the statement
   * @summary Converts the statement's conditions, selectors, and options into a PostgreSQL query
   * @return {PostgresQuery} The built PostgreSQL query
   * @throws {Error} If there are invalid query conditions
   * @mermaid
   * sequenceDiagram
   *   participant Statement
   *   participant Repository
   *   participant parseCondition
   *
   *   Statement->>Statement: build()
   *   Note over Statement: Initialize query
   *   Statement->>Repository: Get table name
   *   Repository-->>Statement: Return table name
   *   Statement->>Statement: Create base query
   *
   *   alt Has selectSelector
   *     Statement->>Statement: Add columns to query
   *   end
   *
   *   alt Has whereCondition
   *     Statement->>Statement: Create combined condition with table
   *     Statement->>parseCondition: Parse condition
   *     parseCondition-->>Statement: Return parsed conditions
   *     Statement->>Statement: Add conditions to query
   *   end
   *
   *   alt Has orderBySelector
   *     Statement->>Statement: Add orderBy to query
   *   end
   *
   *   alt Has limitSelector
   *     Statement->>Statement: Set limit
   *   else
   *     Statement->>Statement: Use default limit
   *   end
   *
   *   alt Has offsetSelector
   *     Statement->>Statement: Set offset
   *   end
   *
   *   Statement-->>Statement: Return query
   */
  protected build(): PostgresQuery {
    const tableName = Repository.table(this.fromSelector);
    const m = new this.fromSelector();
    const q: string[] = [
      `SELECT ${
        this.selectSelector
          ? this.selectSelector.map((k) => `${k.toString()}`).join(", ")
          : "*"
      } from ${tableName}`,
    ];

    const values: any[] = [];
    if (this.whereCondition) {
      const parsed = this.parseCondition(this.whereCondition, tableName);
      const { query } = parsed;
      q.push(` WHERE ${query}`);
      values.push(...parsed.values);
    }

    if (!this.orderBySelector)
      this.orderBySelector = [findPrimaryKey(m).id, OrderDirection.ASC];
    q.push(
      ` ORDER BY ${tableName}.${this.orderBySelector[0] as string} ${this.orderBySelector[1].toUpperCase()}`
    );

    if (this.limitSelector) {
      q.push(` LIMIT ${this.limitSelector}`);
    } else {
      console.warn(
        `No limit selector defined. Using default limit of ${PostgreSQLQueryLimit}`
      );
      q.push(` LIMIT ${PostgreSQLQueryLimit}`);
    }

    // Add offset
    if (this.offsetSelector) q.push(` OFFSET ${this.offsetSelector}`);

    q.push(";");
    return {
      query: q.join(""),
      values: values,
    };
  }

  /**
   * @description Creates a paginator for the statement
   * @summary Builds the query and returns a PostgreSQLPaginator for paginated results
   * @template R - The result type
   * @param {number} size - The page size
   * @return {Promise<Paginator<M, R, PostgreSQLQuery>>} A promise that resolves to a paginator
   * @throws {InternalError} If there's an error building the query
   */
  async paginate<R>(size: number): Promise<Paginator<M, R, PostgresQuery>> {
    try {
      const query: PostgresQuery = this.build();
      return new PostgresPaginator(
        this.adapter as any,
        query,
        size,
        this.fromSelector
      );
    } catch (e: any) {
      throw new InternalError(e);
    }
  }

  /**
   * @description Processes a record from PostgreSQL
   * @summary Converts a raw PostgreSQL record to a model instance
   * @param {any} r - The raw record from PostgreSQL
   * @param pkAttr - The primary key attribute of the model
   * @param {"Number" | "BigInt" | undefined} sequenceType - The type of the sequence
   * @return {any} The processed record
   */
  private processRecord(r: any, pkAttr: keyof M) {
    if (typeof r[pkAttr] !== "undefined") {
      return this.adapter.revert(r, this.fromSelector, pkAttr, r[pkAttr]);
    }
    return r;
  }

  /**
   * @description Executes a raw PostgreSQL query
   * @summary Sends a raw PostgreSQL query to the database and processes the results
   * @template R - The result type
   * @param {PostgresQuery} rawInput - The raw PostgreSQL query to execute
   * @return {Promise<R>} A promise that resolves to the query results
   */
  override async raw<R>(rawInput: PostgresQuery): Promise<R> {
    const results: any[] = await this.adapter.raw(rawInput, true);

    const pkDef = findPrimaryKey(new this.fromSelector());
    const pkAttr = pkDef.id;

    if (!this.selectSelector)
      return results.map((r) => this.processRecord(r, pkAttr)) as R;
    return results as R;
  }

  /**
   * @description Parses a condition into PostgreSQL conditions
   * @summary Converts a Condition object into PostgreSQL condition structures
   * @param {Condition<M>} condition - The condition to parse
   * @param {string} [tableName] - the positional index of the arguments
   * @return {PostgresQuery} The PostgresSQL condition
   * @mermaid
   * sequenceDiagram
   *   participant Statement
   *   participant translateOperators
   *   participant parseCondition
   *
   *   Statement->>Statement: parseCondition(condition)
   *
   *   Note over Statement: Extract condition parts
   *
   *   alt Simple comparison operator
   *     Statement->>translateOperators: translateOperators(operator)
   *     translateOperators-->>Statement: Return PostgreSQL operator
   *     Statement->>Statement: Create condition with column, operator, and value
   *   else NOT operator
   *     Statement->>Statement: parseCondition(attr1)
   *     Statement->>Statement: Add NOT to conditions
   *   else AND/OR operator
   *     Statement->>Statement: parseCondition(attr1)
   *     Statement->>Statement: parseCondition(comparison)
   *     Statement->>Statement: Combine conditions with AND/OR
   *   end
   *
   *   Statement-->>Statement: Return conditions array
   */
  protected parseCondition(
    condition: Condition<M>,
    tableName: string
  ): PostgresQuery {
    let valueCount = 0;
    const { attr1, operator, comparison } = condition as unknown as {
      attr1: string | Condition<M>;
      operator: Operator | GroupOperator;
      comparison: any;
    };

    let postgresCondition: PostgresQuery;
    // For simple comparison operators
    if (
      [GroupOperator.AND, GroupOperator.OR, Operator.NOT].indexOf(
        operator as GroupOperator
      ) === -1
    ) {
      const sqlOperator = translateOperators(operator);
      postgresCondition = {
        query: ` ${tableName}.${attr1} ${sqlOperator} $${++valueCount}`,
        values: [comparison],
        valueCount: valueCount,
      };
      return postgresCondition;
    }
    // For NOT operator
    else if (operator === Operator.NOT) {
      throw new Error("NOT operator not implemented");
      // const nestedConditions = this.parseCondition(attr1 as Condition<M>);
      // // Apply NOT to each condition
      // return nestedConditions.map((cond) => ({
      //   ...cond,
      //   operator: `NOT ${cond.operator}`,
      // }));
    }
    // For AND/OR operators
    else {
      const leftConditions = this.parseCondition(
        attr1 as Condition<M>,
        tableName
      );
      const rightConditions = this.parseCondition(
        comparison as Condition<M>,
        tableName
      );

      const updatedRightQuery = rightConditions.query.replace(
        /\$(\d+)/g,
        (_, num) => `$${Number(num) + leftConditions.values.length}`
      );

      postgresCondition = {
        query: ` ((${leftConditions.query}) ${operator} (${updatedRightQuery}))`,
        values: [...leftConditions.values, ...rightConditions.values],
      };
      return postgresCondition;
    }
  }
}
