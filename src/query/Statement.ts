import {
  Condition,
  GroupOperator,
  Operator,
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
import { PostgresKeys } from "../constants";
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
    let valueCounter = 2;

    const q: string[] = [`SELECT $1 from $2 as t`];

    const values: any[] = [
      this.selectSelector
        ? this.selectSelector.map((k) => `t.${k.toString()}`).join(", ")
        : "*",
      tableName,
    ];

    if (this.whereCondition) {
      const { query, values, valueCount } = this.parseCondition(
        this.whereCondition
      );
      q.push(query);
      values.push(...values);
      valueCounter = valueCount as number;
    }

    if (this.orderBySelector) {
      q.push(` ORDER BY $${++valueCounter} $${++valueCounter}`);
      values.push(this.orderBySelector[0], this.orderBySelector[1]);
    }

    if (this.limitSelector) {
      q.push(` LIMIT $${++valueCounter}`);
      values.push(this.limitSelector);
    } else {
      console.warn(
        `No limit selector defined. Using default limit of ${PostgreSQLQueryLimit}`
      );
      q.push(` LIMIT $${++valueCounter}`);
      values.push(PostgreSQLQueryLimit);
    }

    // Add offset
    if (this.offsetSelector) {
      q.push(` OFFSET $${++valueCounter}`);
      values.push(this.limitSelector);
    }

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
  private processRecord(
    r: any,
    pkAttr: keyof M,
    sequenceType: "Number" | "BigInt" | undefined
  ) {
    if (r[pkAttr]) {
      return this.adapter.revert(
        r,
        this.fromSelector,
        pkAttr,
        Sequence.parseValue(sequenceType, r[pkAttr])
      );
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
    const type = pkDef.props.type;

    if (!this.selectSelector)
      return results.map((r) => this.processRecord(r, pkAttr, type)) as R;
    return results as R;
  }

  /**
   * @description Parses a condition into PostgreSQL conditions
   * @summary Converts a Condition object into PostgreSQL condition structures
   * @param {Condition<M>} condition - The condition to parse
   * @param {number} [valueCount=0] - the positional index of the arguments
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
    valueCount: number = 0
  ): PostgresQuery {
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
        query: ` t.${attr1} ${sqlOperator} $${++valueCount}`,
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
      const leftConditions = this.parseCondition(attr1 as Condition<M>);
      const rightConditions = this.parseCondition(comparison as Condition<M>);
      postgresCondition = {
        query: ` ((${leftConditions.query}) ${operator} (${rightConditions.query}))`,
        values: [...leftConditions.values, ...rightConditions.values],
        valueCount: valueCount,
      };
      return postgresCondition;
    }
  }
}
