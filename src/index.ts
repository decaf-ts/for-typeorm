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
 * @description TypeORM integration for Decaf.ts.
 * @summary Provides the TypeORM-backed implementation of the Decaf.ts data access abstractions, including the adapter, repository, statement builder, pagination utilities, index helpers, and type definitions. Key exports include {@link TypeORMAdapter}, {@link TypeORMRepository}, {@link TypeORMStatement}, {@link TypeORMPaginator}, and index generation utilities.
 * @module for-typeorm
 */

/**
 * @description Stores the current package version.
 * @summary The version string of the for-typeorm package.
 * @const VERSION
 * @memberOf module:for-typeorm
 */
export const VERSION = "##VERSION##";
