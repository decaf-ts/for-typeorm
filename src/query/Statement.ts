import {
  Adapter,
  Condition,
  ContextualArgs,
  GroupOperator,
  Operator,
  OrderDirection,
  Paginator,
  QueryError,
  Statement,
  UnsupportedError,
} from "@decaf-ts/core";
import { Model } from "@decaf-ts/decorator-validation";
import { translateOperators } from "./translate";
import { TypeORMQueryLimit } from "./constants";
import { TypeORMQuery } from "../types";
import { TypeORMAdapter, TypeORMContext } from "../TypeORMAdapter";
import {
  FindManyOptions,
  FindOperator,
  In,
  Like,
  LessThan,
  LessThanOrEqual,
  MoreThan,
  MoreThanOrEqual,
  Raw,
  Between,
  SelectQueryBuilder,
} from "typeorm";
import { FindOptionsWhere } from "typeorm/find-options/FindOptionsWhere";
import { splitEagerRelations } from "../utils";
import { Metadata } from "@decaf-ts/decoration";

/**
 * @description Statement builder for TypeORM-backed queries.
 * @summary Provides a fluent interface for building SQL queries via TypeORM's SelectQueryBuilder with type safety and Decaf.ts abstractions.
 * @template M The model type that extends Model.
 * @template R The result type returned from execution.
 * @param {TypeORMAdapter} adapter The TypeORM adapter.
 * @class TypeORMStatement
 * @example
 * // Example using TypeORMStatement
 * const statement = new TypeORMStatement<User, User[]>(adapter);
 * const users = await statement
 *   .from(User)
 *   .where(Condition.attribute<User>('age').gt(18))
 *   .orderBy('lastName', 'asc')
 *   .limit(10)
 *   .execute();
 */
export class TypeORMStatement<M extends Model, R> extends Statement<
  M,
  Adapter<any, any, any>,
  R,
  TypeORMQuery<M>
> {
  protected override adapter!: TypeORMAdapter;

  constructor(adapter: TypeORMAdapter) {
    super(adapter);
  }

  /**
   * @description Builds a TypeORM SelectQueryBuilder from the statement.
   * @summary Converts the statement's conditions, selectors, and options into a TypeORM-backed query object.
   * @return {TypeORMQuery} The built TypeORM query container.
   * @throws {Error} If there are invalid query conditions.
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
  protected build(): TypeORMQuery<M> {
    const log = this.log.for(this.build);
    const tableName = Model.tableName(this.fromSelector);

    const q: TypeORMQuery<M, SelectQueryBuilder<M>> = {
      query: this.adapter.client
        .getRepository(Metadata.constr(this.fromSelector))
        .createQueryBuilder(tableName) as SelectQueryBuilder<M>,
    };

    // Handle aggregation functions
    if (typeof this.countSelector !== "undefined") {
      // COUNT or COUNT(field)
      const field =
        this.countSelector === null
          ? "*"
          : `${tableName}.${this.countSelector as string}`;
      q.query = q.query.select(`COUNT(${field})`, "count");
    } else if (typeof this.countDistinctSelector !== "undefined") {
      // COUNT DISTINCT
      const field =
        this.countDistinctSelector === null
          ? "*"
          : `${tableName}.${this.countDistinctSelector as string}`;
      q.query = q.query.select(`COUNT(DISTINCT ${field})`, "count");
    } else if (this.sumSelector) {
      // SUM
      q.query = q.query.select(
        `SUM(${tableName}.${this.sumSelector as string})`,
        "sum"
      );
    } else if (this.avgSelector) {
      // AVG
      q.query = q.query.select(
        `AVG(${tableName}.${this.avgSelector as string})`,
        "avg"
      );
    } else if (this.maxSelector) {
      // MAX
      q.query = q.query.select(
        `MAX(${tableName}.${this.maxSelector as string})`,
        "max"
      );
    } else if (this.minSelector) {
      // MIN
      q.query = q.query.select(
        `MIN(${tableName}.${this.minSelector as string})`,
        "min"
      );
    } else if (this.distinctSelector) {
      // DISTINCT
      q.query = q.query.select(
        `DISTINCT ${tableName}.${this.distinctSelector as string}`,
        this.distinctSelector as string
      );
    } else if (this.selectSelector) {
      // Regular select with specific fields
      q.query = q.query.select(
        this.selectSelector.map((s) => `${tableName}.${s as string}`)
      );
    } else {
      // Select all
      q.query = q.query.select();
    }

    if (this.whereCondition)
      q.query = this.parseCondition(
        this.whereCondition,
        tableName,
        q.query as SelectQueryBuilder<any>
      ).query as unknown as SelectQueryBuilder<M>;

    // Handle GROUP BY
    if (this.groupBySelectors && this.groupBySelectors.length) {
      const [primary, ...rest] = this.groupBySelectors;
      q.query = (q.query as SelectQueryBuilder<any>).groupBy(
        `${tableName}.${primary as string}`
      );
      for (const attr of rest) {
        q.query = (q.query as SelectQueryBuilder<any>).addGroupBy(
          `${tableName}.${attr as string}`
        );
      }
    }

    // Handle ordering - support multi-level sort with orderBySelectors
    // Skip default ordering for aggregation queries (count, sum, avg, etc.)
    const isAggregation = this.hasAggregation();
    if (!isAggregation) {
      if (!this.orderBySelectors || !this.orderBySelectors.length) {
        q.query = (q.query as SelectQueryBuilder<any>).orderBy(
          `${tableName}.${Model.pk(this.fromSelector) as string}`,
          OrderDirection.ASC.toUpperCase() as "ASC"
        );
      } else {
        // Primary orderBy
        const [primaryAttr, primaryDir] = this.orderBySelectors[0];
        q.query = (q.query as SelectQueryBuilder<any>).orderBy(
          `${tableName}.${primaryAttr as string}`,
          primaryDir.toUpperCase() as "DESC" | "ASC"
        );
        // Additional orderBy clauses (thenBy)
        for (let i = 1; i < this.orderBySelectors.length; i++) {
          const [attr, dir] = this.orderBySelectors[i];
          q.query = (q.query as SelectQueryBuilder<any>).addOrderBy(
            `${tableName}.${attr as string}`,
            dir.toUpperCase() as "DESC" | "ASC"
          );
        }
      }
    } else if (this.orderBySelectors && this.orderBySelectors.length) {
      // For aggregations, only add order if explicitly specified
      const [primaryAttr, primaryDir] = this.orderBySelectors[0];
      q.query = (q.query as SelectQueryBuilder<any>).orderBy(
        `${tableName}.${primaryAttr as string}`,
        primaryDir.toUpperCase() as "DESC" | "ASC"
      );
      for (let i = 1; i < this.orderBySelectors.length; i++) {
        const [attr, dir] = this.orderBySelectors[i];
        q.query = (q.query as SelectQueryBuilder<any>).addOrderBy(
          `${tableName}.${attr as string}`,
          dir.toUpperCase() as "DESC" | "ASC"
        );
      }
    }

    // For non-aggregation queries, apply limit
    if (!isAggregation) {
      if (this.limitSelector) {
        q.query = (q.query as SelectQueryBuilder<any>).limit(
          this.limitSelector
        );
      } else {
        log.debug(
          `No limit selector defined. Using default limit of ${TypeORMQueryLimit}`
        );
        q.query = (q.query as SelectQueryBuilder<any>).limit(TypeORMQueryLimit);
      }
    } else if (this.limitSelector) {
      // For aggregations, only apply limit if explicitly set
      q.query = (q.query as SelectQueryBuilder<any>).limit(this.limitSelector);
    }

    // Add offset
    if (this.offsetSelector)
      q.query = (q.query as SelectQueryBuilder<any>).skip(this.offsetSelector);

    return q as any;
  }

  /**
   * @description Creates a paginator for the statement.
   * @summary Builds the query and returns a TypeORMPaginator for paginated results.
   * @template R The result type.
   * @param {number} size The page size.
   * @return {Promise<Paginator<M, R, TypeORMQuery>>} A promise that resolves to a paginator.
   * @throws {InternalError} If there's an error building the query.
   */
  override async paginate<R>(
    size: number
  ): Promise<Paginator<M, R, TypeORMQuery>> {
    try {
      const transformedQuery: FindManyOptions<M> = {};
      if (this.whereCondition)
        transformedQuery.where = this.parseConditionForPagination(
          this.whereCondition,
          Model.tableName(this.fromSelector)
        );

      if (this.orderBySelectors && this.orderBySelectors.length) {
        const orderObj: Record<string, string> = {};
        for (const [attr, dir] of this.orderBySelectors) {
          orderObj[attr as string] = dir.toString().toUpperCase();
        }
        transformedQuery.order = orderObj as any;
      }

      return this.adapter.Paginator(
        transformedQuery as any,
        size,
        this.fromSelector
      );
    } catch (e: any) {
      throw new QueryError(e);
    }
  }
  //
  // /**
  //  * @description Processes a record.
  //  * @summary Converts a raw result row to a model instance using the adapter.
  //  * @param {any} r The raw record.
  //  * @param {string} pkAttr The primary key attribute of the model.
  //  * @return {any} The processed record.
  //  */
  // private processRecord(r: any, pkAttr: keyof M) {
  //   if (typeof r[pkAttr] !== "undefined") {
  //     return this.adapter.revert(r, this.fromSelector, pkAttr, r[pkAttr]);
  //   }
  //   return r;
  // }

  /**
   * @description Executes a raw TypeORM query builder.
   * @summary Sends the built SelectQueryBuilder to the database via TypeORM and returns the results.
   * @template R The result type.
   * @param {TypeORMQuery} rawInput The query container to execute.
   * @return {Promise<R>} A promise that resolves to the query results.
   */
  override async raw<R>(
    rawInput: TypeORMQuery<M>,
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<R> {
    const { ctx } = this.logCtx(args, this.raw);
    const allowRawStatements = ctx.get("allowRawStatements");
    if (!allowRawStatements)
      throw new UnsupportedError(
        "Raw statements are not allowed in the current configuration"
      );

    const qb = rawInput.query as unknown as SelectQueryBuilder<M>;

    // Handle aggregation queries
    if (this.hasAggregation()) {
      // For scalar aggregations (COUNT, SUM, AVG, MAX, MIN without GROUP BY)
      if (!this.groupBySelectors || !this.groupBySelectors.length) {
        const result = await qb.getRawOne();
        // Extract the scalar value from the result object
        if (
          typeof this.countSelector !== "undefined" ||
          typeof this.countDistinctSelector !== "undefined"
        ) {
          return Number(result?.count || 0) as R;
        } else if (this.sumSelector) {
          return Number(result?.sum || 0) as R;
        } else if (this.avgSelector) {
          return Number(result?.avg || 0) as R;
        } else if (this.maxSelector) {
          return result?.max as R;
        } else if (this.minSelector) {
          return result?.min as R;
        } else if (this.distinctSelector) {
          // DISTINCT returns multiple values
          const results = await qb.getRawMany();
          return results.map(
            (r: any) => r[this.distinctSelector as string]
          ) as R;
        }
        return result as R;
      } else {
        // For GROUP BY queries, get raw results
        const results = await qb.getRawMany();
        // Transform results into grouped structure
        return this.groupResults(results) as R;
      }
    }

    // Standard query - load relations
    const { nonEager } = splitEagerRelations(this.fromSelector);
    rawInput.query = qb.setFindOptions({
      loadEagerRelations: true,
      loadRelationIds: {
        relations: nonEager,
      },
    }) as any;

    return (await (
      rawInput.query as unknown as SelectQueryBuilder<M>
    ).getMany()) as R;
  }

  /**
   * @description Groups raw query results by the groupBySelectors
   * @summary Transforms flat results into nested grouped structure
   */
  protected groupResults(results: any[]): any {
    if (!this.groupBySelectors || !this.groupBySelectors.length) {
      return results;
    }

    const tableName = Model.tableName(this.fromSelector);
    const groupKeys = this.groupBySelectors.map(
      (s) => `${tableName}_${s as string}`
    );

    // Build nested structure
    const grouped: Record<string, any> = {};
    for (const row of results) {
      let current = grouped;
      for (let i = 0; i < groupKeys.length - 1; i++) {
        const key = row[groupKeys[i]];
        if (!current[key]) {
          current[key] = {};
        }
        current = current[key];
      }
      const lastKey = row[groupKeys[groupKeys.length - 1]];
      if (!current[lastKey]) {
        current[lastKey] = [];
      }
      current[lastKey].push(row);
    }

    return grouped;
  }

  protected parseConditionForPagination(
    condition: Condition<M>,
    tableName: string,
    counter = 0,
    conditionalOp?: GroupOperator | Operator
  ): FindOptionsWhere<M>[] | FindOptionsWhere<M> {
    const { attr1, operator, comparison } = condition as unknown as {
      attr1: string | Condition<M>;
      operator: Operator | GroupOperator;
      comparison: any;
    };

    const buildSimpleCondition = () => {
      if (typeof attr1 !== "string") {
        throw new QueryError("Invalid attribute for pagination condition");
      }
      return {
        [attr1]: this.buildFindValue(operator as Operator, comparison),
      } as FindOptionsWhere<M>;
    };

    if (
      [GroupOperator.AND, GroupOperator.OR, Operator.NOT].indexOf(
        operator as GroupOperator
      ) === -1
    ) {
      return buildSimpleCondition();
    }

    if (operator === GroupOperator.OR) {
      const left =
        attr1 instanceof Condition
          ? this.parseConditionForPagination(
              attr1,
              tableName,
              ++counter,
              conditionalOp
            )
          : buildSimpleCondition();
      const right =
        comparison instanceof Condition
          ? this.parseConditionForPagination(
              comparison,
              tableName,
              ++counter,
              conditionalOp
            )
          : buildSimpleCondition();
      const flatten = (value: any) =>
        Array.isArray(value) ? value : value ? [value] : [];
      return [...flatten(left), ...flatten(right)];
    }

    if (operator === GroupOperator.AND) {
      const left =
        attr1 instanceof Condition
          ? this.parseConditionForPagination(
              attr1,
              tableName,
              ++counter,
              conditionalOp
            )
          : buildSimpleCondition();
      const right =
        comparison instanceof Condition
          ? this.parseConditionForPagination(
              comparison,
              tableName,
              ++counter,
              conditionalOp
            )
          : buildSimpleCondition();
      if (Array.isArray(left) || Array.isArray(right)) {
        throw new QueryError(
          "AND conditions with OR branches are not supported in pagination"
        );
      }
      return {
        ...((left || {}) as FindOptionsWhere<M>),
        ...((right || {}) as FindOptionsWhere<M>),
      };
    }

    throw new QueryError("NOT operator is not supported for pagination");
  }

  private buildFindValue(
    operator: Operator,
    comparison: any
  ): FindOperator<any> | any {
    switch (operator) {
      case Operator.STARTS_WITH:
        return Like(`${comparison}%`);
      case Operator.ENDS_WITH:
        return Like(`%${comparison}`);
      case Operator.REGEXP:
        return Raw((alias) => `${alias} ~ :regex`, { regex: comparison });
      case Operator.IN:
        return In(Array.isArray(comparison) ? comparison : [comparison]);
      case Operator.BETWEEN:
        if (!Array.isArray(comparison) || comparison.length !== 2)
          throw new QueryError(
            "BETWEEN operator requires an array with two values"
          );
        return Between(comparison[0], comparison[1]);
      case Operator.BIGGER:
        return MoreThan(comparison);
      case Operator.BIGGER_EQ:
        return MoreThanOrEqual(comparison);
      case Operator.SMALLER:
        return LessThan(comparison);
      case Operator.SMALLER_EQ:
        return LessThanOrEqual(comparison);
      default:
        return comparison;
    }
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
  ): TypeORMQuery<M> {
    const { attr1, operator, comparison } = condition as unknown as {
      attr1: string | Condition<M>;
      operator: Operator | GroupOperator;
      comparison: any;
    };

    function parse(): TypeORMQuery<M> {
      const sqlOperator = translateOperators(operator);
      const attrRef = `${attr1}${counter}`;
      let queryStr: string;
      let values: Record<string, any>;

      // Handle BETWEEN operator specially - comparison is [min, max]
      if (operator === Operator.BETWEEN) {
        const [min, max] = comparison as [any, any];
        const minRef = `${attr1}${counter}_min`;
        const maxRef = `${attr1}${counter}_max`;
        queryStr = `${tableName}.${attr1} ${sqlOperator} :${minRef} AND :${maxRef}`;
        values = {
          [minRef]: min,
          [maxRef]: max,
        };
      } else if (operator === Operator.IN) {
        // Handle IN operator - comparison is an array
        queryStr = `${tableName}.${attr1} ${sqlOperator} (:...${attrRef})`;
        values = {
          [attrRef]: comparison,
        };
      } else {
        if (
          operator === Operator.STARTS_WITH ||
          operator === Operator.ENDS_WITH
        ) {
          if (typeof comparison !== "string")
            throw new QueryError(
              `Operator ${operator} requires a string comparison value`
            );
        }
        const paramValue =
          operator === Operator.STARTS_WITH
            ? `${comparison}%`
            : operator === Operator.ENDS_WITH
              ? `%${comparison}`
              : comparison;
        queryStr = `${tableName}.${attr1} ${sqlOperator} :${attrRef}`;
        values = {
          [attrRef]: paramValue,
        };
      }

      switch (conditionalOp) {
        case GroupOperator.AND:
          return {
            query: qb.andWhere(queryStr, values) as any,
          };
        case GroupOperator.OR:
          return {
            query: qb.orWhere(queryStr, values) as any,
          };
        case Operator.NOT:
          throw new Error("NOT operator not implemented");
        default:
          return {
            query: qb.where(queryStr, values) as any,
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
        .query as unknown as SelectQueryBuilder<M>;
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
