import { SelectQueryBuilder } from "typeorm";
import { Model } from "@decaf-ts/decorator-validation";
import { AdapterFlags } from "@decaf-ts/core";
import { Logger } from "@decaf-ts/logging";

/**
 * @description SQL operators available for building TypeORM queries.
 * @summary Enumeration of common SQL operators intended for use within TypeORM query construction and translation layers.
 * @enum {string}
 * @memberOf module:for-typeorm
 */
/**
 * @description SQL operators available for building TypeORM queries.
 * @summary Enumeration of common SQL operators intended for use within TypeORM query construction and translation layers.
 * @enum {string}
 * @readonly
 * @memberOf module:for-typeorm
 */
export enum SQLOperator {
  /** Exact equality comparison (=) */
  EQUAL = "=",
  /** Inequality comparison (<>) */
  NOT_EQUAL = "<>",
  /** Less-than comparison (<) */
  LESS_THAN = "<",
  /** Less-than or equal comparison (<=) */
  LESS_THAN_OR_EQUAL = "<=",
  /** Greater-than comparison (>) */
  GREATER_THAN = ">",
  /** Greater-than or equal comparison (>=) */
  GREATER_THAN_OR_EQUAL = ">=",
  /** Membership in a set (IN) */
  IN = "IN",
  /** Non-membership in a set (NOT IN) */
  NOT_IN = "NOT IN",
  /** Pattern match using LIKE */
  LIKE = "LIKE",
  /** Case-insensitive pattern match using ILIKE (Postgres) */
  ILIKE = "ILIKE",
  /** Range comparison using BETWEEN */
  BETWEEN = "BETWEEN",
  /** Null check (IS NULL) */
  IS_NULL = "IS NULL",
  /** Not-null check (IS NOT NULL) */
  IS_NOT_NULL = "IS NOT NULL",
  /** Existence of rows (EXISTS) */
  EXISTS = "EXISTS",
  /** Non-existence of rows (NOT EXISTS) */
  NOT_EXISTS = "NOT EXISTS",
  /** Compare to any value in an array (ANY) */
  ANY = "ANY",
  /** Compare to all values in an array (ALL) */
  ALL = "ALL",
  /** Compare to some values in an array (SOME) */
  SOME = "SOME",
}

/**
 * @description Query container used by the TypeORM adapter.
 * @summary Represents either a raw SQL string or a TypeORM SelectQueryBuilder along with optional bound values to be executed by the adapter.
 * @template M The Model type for which the SelectQueryBuilder is parameterized.
 * @template T The underlying query type, either a string or a SelectQueryBuilder<M>.
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
export type TypeORMFlags<LOG extends Logger = Logger> = AdapterFlags<LOG> & {
  /**
   * @description User authentication information for Postgres database connections
   */
  user: string;
};

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
