import { RepositoryFlags } from "@decaf-ts/db-decorators";

/**
 * @description SQL operators available in PostgreSQL queries
 * @summary Enum of standard SQL operators that can be used in PostgreSQL queries
 * @enum {string}
 * @memberOf module:for-postgres
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

export interface PostgresQuery {
  query: string;
  values: any[];
  valueCount?: number;
}

/**
 * @description Configuration flags for Postgres database operations
 * @summary Extended repository flags that include user authentication information for Postgres database connections
 * @interface PostgresFlags
 * @memberOf module:for-postgres
 */
export interface PostgresFlags extends RepositoryFlags {
  /**
   * @description User authentication information for Postgres database connections
   */
  user: {
    /**
     * @description Username for authentication with the Postgres database
     */
    name: string;
    /**
     * @description Optional array of roles assigned to the user
     */
    roles?: string[];
  };
}
