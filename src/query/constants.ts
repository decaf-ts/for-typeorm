import { SQLOperator } from "../types";

/**
 * @description Default query limit for PostgreSQL queries
 * @summary Maximum number of rows to return in a single query
 * @const TypeORMQueryLimit
 * @memberOf module:for-postgres
 */
export const TypeORMQueryLimit = 250;

/**
 * @description Mapping of operator names to PostgreSQL SQL operators
 * @summary Constants for PostgreSQL comparison operators used in SQL queries
 * @typedef {Object} PostgreSQLOperatorType
 * @property {string} EQUAL - Equality operator (=)
 * @property {string} DIFFERENT - Inequality operator (<>)
 * @property {string} BIGGER - Greater than operator (>)
 * @property {string} BIGGER_EQ - Greater than or equal operator (>=)
 * @property {string} SMALLER - Less than operator (<)
 * @property {string} SMALLER_EQ - Less than or equal operator (<=)
 * @property {string} NOT - Negation operator (NOT)
 * @property {string} IN - In array operator (IN)
 * @property {string} REGEXP - Regular expression operator (~)
 * @property {string} IREGEXP - Case-insensitive regular expression operator (~*)
 * @property {string} LIKE - Pattern matching operator (LIKE)
 * @property {string} ILIKE - Case-insensitive pattern matching operator (ILIKE)
 * @property {string} BETWEEN - Range operator (BETWEEN)
 * @property {string} IS_NULL - NULL check operator (IS NULL)
 * @property {string} IS_NOT_NULL - NOT NULL check operator (IS NOT NULL)
 * @const TypeORMOperator
 * @type {PostgreSQLOperatorType}
 * @memberOf module:for-postgres
 */
export const TypeORMOperator: Record<string, SQLOperator | string> = {
  EQUAL: SQLOperator.EQUAL,
  DIFFERENT: SQLOperator.NOT_EQUAL,
  BIGGER: SQLOperator.GREATER_THAN,
  BIGGER_EQ: SQLOperator.GREATER_THAN_OR_EQUAL,
  SMALLER: SQLOperator.LESS_THAN,
  SMALLER_EQ: SQLOperator.LESS_THAN_OR_EQUAL,
  BETWEEN: SQLOperator.BETWEEN,
  NOT: "NOT",
  IN: SQLOperator.IN,
  IS_NULL: SQLOperator.IS_NULL,
  IS_NOT_NULL: SQLOperator.IS_NOT_NULL,
  REGEXP: "~",
  IREGEXP: "~*",
  LIKE: SQLOperator.LIKE,
  ILIKE: SQLOperator.ILIKE,
};

/**
 * @description Mapping of logical operator names to PostgreSQL SQL operators
 * @summary Constants for PostgreSQL logical operators used in SQL queries
 * @typedef {Object} PostgreSQLGroupOperatorType
 * @property {string} AND - Logical AND operator (AND)
 * @property {string} OR - Logical OR operator (OR)
 * @const TypeORMGroupOperator
 * @type {PostgreSQLGroupOperatorType}
 * @memberOf module:for-postgres
 */
export const TypeORMGroupOperator: Record<string, string> = {
  AND: "AND",
  OR: "OR",
};

/**
 * @description Special constant values used in PostgreSQL queries
 * @summary String constants representing special values in PostgreSQL
 * @typedef {Object} PostgreSQLConstType
 * @property {string} NULL - String representation of null value
 * @const TypeORMConst
 * @memberOf module:for-postgres
 */
export const TypeORMConst: Record<string, string> = {
  NULL: "NULL",
};
