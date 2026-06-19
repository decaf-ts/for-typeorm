import { detectTypeORMDriver, TypeORMDriver } from "./types";
import { Metadata } from "@decaf-ts/decoration";
import { TypeORMAdapter } from "./TypeORMAdapter";
import "@decaf-ts/core";
export * from "./indexes";
export * from "./query";
export * from "./sequences";
export { TypeORMAdapter };
export * from "./constants";
export * from "./errors";
export * from "./TypeORMContextLock";
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

/**
 * @description Represents the current commit hash of the module build.
 * @summary Stores the current git commit hash for the package. The build replaces
 * the placeholder with the actual commit hash at publish time.
 * @const COMMIT
 */
export const COMMIT = "##COMMIT##";

/**
 * @description Represents the full version string of the module.
 * @summary Stores the semver version and commit hash for the package.
 * The build replaces the placeholder with the actual `<version>-<commit>` value at publish time.
 * @const FULL_VERSION
 */
export const FULL_VERSION = "##FULL_VERSION##";


/**
 * @description Stores the current package version.
 * @summary The version string of the for-typeorm package.
 * @const PACKAGE_NAME
 * @memberOf module:for-typeorm
 */
export const PACKAGE_NAME = "##PACKAGE##";

export { detectTypeORMDriver, TypeORMDriver };
Metadata.registerLibrary(PACKAGE_NAME, VERSION);
