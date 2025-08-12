import {
  Condition,
  GroupOperator,
  Operator,
  OrderDirection,
  Paginator,
  Repository,
  Statement,
} from "@decaf-ts/core";
import { Model, ModelKeys } from "@decaf-ts/decorator-validation";
import { translateOperators } from "./translate";
import { TypeORMQueryLimit } from "./constants";
import { TypeORMPaginator } from "./Paginator";
import { findPrimaryKey, InternalError } from "@decaf-ts/db-decorators";
import { TypeORMQuery } from "../types";
import { TypeORMAdapter } from "../TypeORMAdapter";
import { QueryBuilder, SelectQueryBuilder } from "typeorm";

/**
 * @description Statement builder for PostgreSQL queries
 * @summary Provides a fluent interface for building PostgreSQL queries with type safety
 * @template M - The model type that extends Model
 * @template R - The result type
 * @param adapter - The PostgreSQL adapter
 * @class TypeORMStatement
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
export class TypeORMStatement<M extends Model, R> extends Statement<
  TypeORMQuery,
  M,
  R
> {
  protected override adapter!: TypeORMAdapter;

  constructor(adapter: TypeORMAdapter) {
    super(adapter);
  }

  /**
   * @description Builds a PostgreSQL query from the statement
   * @summary Converts the statement's conditions, selectors, and options into a PostgreSQL query
   * @return {TypeORMQuery} The built PostgreSQL query
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
  protected build(): TypeORMQuery {
    const tableName = Repository.table(this.fromSelector);
    const m = new this.fromSelector();

    const q: TypeORMQuery = {
      query: this.adapter.dataSource
        .getRepository(
          this.fromSelector[ModelKeys.ANCHOR as keyof typeof this.fromSelector]
        )
        .createQueryBuilder(),
    };

    if (this.selectSelector)
      q.query = q.query.select(
        this.selectSelector.map((s) => `${tableName}.${s as string}`)
      );
    else q.query = q.query.select(tableName);

    q.query = (q.query as SelectQueryBuilder<any>).from(
      this.fromSelector[ModelKeys.ANCHOR as keyof typeof this.fromSelector],
      tableName
    );

    if (this.whereCondition)
      q.query = this.parseCondition(
        this.whereCondition,
        tableName,
        q.query as SelectQueryBuilder<any>
      ).query;

    let orderByArgs: [string, "DESC" | "ASC"];
    if (!this.orderBySelector)
      orderByArgs = [
        `${tableName}.${findPrimaryKey(m).id as string}`,
        OrderDirection.ASC.toUpperCase() as "ASC",
      ];
    else
      orderByArgs = [
        `${tableName}.${this.orderBySelector[0] as string}`,
        this.orderBySelector[1].toUpperCase() as "DESC" | "ASC",
      ];

    q.query = (q.query as SelectQueryBuilder<any>).orderBy(...orderByArgs);
    if (this.limitSelector) {
      q.query = (q.query as SelectQueryBuilder<any>).limit(this.limitSelector);
    } else {
      console.warn(
        `No limit selector defined. Using default limit of ${TypeORMQueryLimit}`
      );
      q.query = (q.query as SelectQueryBuilder<any>).limit(TypeORMQueryLimit);
    }

    // Add offset
    if (this.offsetSelector)
      q.query = (q.query as SelectQueryBuilder<any>).skip(this.offsetSelector);

    return q;
  }

  /**
   * @description Creates a paginator for the statement
   * @summary Builds the query and returns a PostgreSQLPaginator for paginated results
   * @template R - The result type
   * @param {number} size - The page size
   * @return {Promise<Paginator<M, R, PostgreSQLQuery>>} A promise that resolves to a paginator
   * @throws {InternalError} If there's an error building the query
   */
  async paginate<R>(size: number): Promise<Paginator<M, R, TypeORMQuery>> {
    try {
      const query: TypeORMQuery = this.build();
      return new TypeORMPaginator(
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
   * @param {TypeORMQuery} rawInput - The raw PostgreSQL query to execute
   * @return {Promise<R>} A promise that resolves to the query results
   */
  override async raw<R>(rawInput: TypeORMQuery): Promise<R> {
    return (await (rawInput.query as SelectQueryBuilder<any>).getMany()) as R;
  }

  /**
   * @description Parses a condition into PostgreSQL conditions
   * @summary Converts a Condition object into PostgreSQL condition structures
   * @param {Condition<M>} condition - The condition to parse
   * @param {string} [tableName] - the positional index of the arguments
   * @return {TypeORMQuery} The PostgresSQL condition
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
    tableName: string,
    qb: SelectQueryBuilder<any>,
    counter = 0,
    conditionalOp?: GroupOperator | Operator
  ): TypeORMQuery {
    const { attr1, operator, comparison } = condition as unknown as {
      attr1: string | Condition<M>;
      operator: Operator | GroupOperator;
      comparison: any;
    };

    function parse() {
      const sqlOperator = translateOperators(operator);
      const attrRef = `${attr1}${counter}`;
      const queryStr = `${tableName}.${attr1} ${sqlOperator} :${attrRef}`;
      const values = {
        [attrRef]: comparison,
      };
      switch (conditionalOp) {
        case GroupOperator.AND:
          return {
            query: qb.andWhere(queryStr, values),
          };
        case GroupOperator.OR:
          return {
            query: qb.orWhere(queryStr, values),
          };
        case Operator.NOT:
          throw new Error("NOT operator not implemented");
        default:
          return {
            query: qb.where(queryStr, values),
          };
      }
    }

    if (
      [GroupOperator.AND, GroupOperator.OR, Operator.NOT].indexOf(
        operator as GroupOperator
      ) === -1
    ) {
      return parse();
    }
    // For NOT operator
    else if (operator === Operator.NOT) {
      throw new Error("NOT operator not implemented");
    }
    // For AND/OR operators
    else {
      qb = this.parseCondition(attr1 as Condition<M>, tableName, qb, ++counter)
        .query as SelectQueryBuilder<any>;
      return this.parseCondition(
        comparison,
        tableName,
        qb,
        ++counter,
        operator
      );
    }
  }
}
