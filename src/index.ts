import { TypeORMAdapter } from "./TypeORMAdapter";

TypeORMAdapter.decoration();

export * from "./indexes";
export * from "./query";
export * from "./sequences";
export * from "./TypeORMAdapter";
export * from "./constants";
export * from "./errors";
export * from "./TypeORMDispatch";
export * from "./TypeORMRepository";
export * from "./types";
export * from "./utils";

/**
 * @description TypeORM adapter for Decaf.ts
 * @summary A TypeScript adapter for TypeORM database operations, providing a seamless integration with the Decaf.ts framework. This module includes classes, interfaces, and utilities for working with PostgreSQL databases, including support for SQL queries, table operations, and sequence management.
 * @module for-postgres
 */

/**
 * @description Stores the current package version
 * @summary The version string of the for-postgres package
 * @const VERSION
 */
export const VERSION = "##VERSION##";
