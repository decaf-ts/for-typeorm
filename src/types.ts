import { RepositoryFlags } from "@decaf-ts/db-decorators";
import { QueryBuilder, SelectQueryBuilder } from "typeorm";
import { Model } from "@decaf-ts/decorator-validation";

/**
 * @description SQL operators available for building TypeORM queries.
 * @summary Enumeration of common SQL operators intended for use within TypeORM query construction and translation layers.
 * @enum {string}
 * @memberOf module:for-typeorm
 */
export enum SQLOperator {
  EQUAL = "=",
  NOT_EQUAL = "<>",
  LESS_THAN = "<",
  LESS_THAN_OR_EQUAL = "<=",
  GREATER_THAN = ">",
  GREATER_THAN_OR_EQUAL = ">=",
  IN = "IN",
  NOT_IN = "NOT IN",
  LIKE = "LIKE",
  ILIKE = "ILIKE",
  BETWEEN = "BETWEEN",
  IS_NULL = "IS NULL",
  IS_NOT_NULL = "IS NOT NULL",
  EXISTS = "EXISTS",
  NOT_EXISTS = "NOT EXISTS",
  ANY = "ANY",
  ALL = "ALL",
  SOME = "SOME",
}

/**
 * @description Query container used by the TypeORM adapter.
 * @summary Represents a raw SQL string or a TypeORM SelectQueryBuilder plus optional bound values to be executed by the adapter.
 * @template M The Model type for which the SelectQueryBuilder is parameterized.
 * @template T The underlying query type, either a string or a SelectQueryBuilder<M>.
 * @param {T} query The raw SQL string or SelectQueryBuilder instance.
 * @param {any[]} [values] Optional positional values to bind when executing a raw SQL string.
 * @interface TypeORMQuery
 * @memberOf module:for-typeorm
 */
export interface TypeORMQuery<
  M extends Model = Model,
  T extends string | SelectQueryBuilder<M> = string,
> {
  query: T;
  values?: any[];
}

/**
 * @description Configuration flags for TypeORM operations.
 * @summary Extended repository flags including connection/user context that can be leveraged by the TypeORM adapter.
 * @interface TypeORMFlags
 * @memberOf module:for-typeorm
 */
export interface TypeORMFlags extends RepositoryFlags {
  /**
   * @description User authentication information for Postgres database connections
   */
  user: string;
}

/**
 * @description Specification for a table creation/change statement used by the TypeORM adapter.
 * @summary Extends a TypeORMQuery with table metadata such as primary key flag, constraints, and foreign keys.
 * @typedef TypeORMTableSpec
 * @property {boolean} primaryKey Indicates if the target column is part of the primary key.
 * @property {string[]} constraints A list of raw SQL constraints to apply to the table/column.
 * @property {string[]} foreignKeys A list of foreign key constraint definitions.
 * @memberOf module:for-typeorm
 */
export type TypeORMTableSpec = TypeORMQuery & {
  primaryKey: boolean;
  constraints: string[];
  foreignKeys: string[];
};
