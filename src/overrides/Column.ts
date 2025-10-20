import type { GeneratedMetadataArgs } from "typeorm/metadata-args/GeneratedMetadataArgs";
import {
  ColumnOptions,
  ColumnType,
  ColumnTypeUndefinedError,
  getMetadataArgsStorage,
} from "typeorm";
import {
  SimpleColumnType,
  SpatialColumnType,
  WithLengthColumnType,
  WithPrecisionColumnType,
  WithWidthColumnType,
} from "typeorm/driver/types/ColumnTypes";
import type { ColumnCommonOptions } from "typeorm/decorator/options/ColumnCommonOptions";
import type { SpatialColumnOptions } from "typeorm/decorator/options/SpatialColumnOptions";
import type { ColumnWithLengthOptions } from "typeorm/decorator/options/ColumnWithLengthOptions";
import type { ColumnWithWidthOptions } from "typeorm/decorator/options/ColumnWithWidthOptions";
import type { ColumnNumericOptions } from "typeorm/decorator/options/ColumnNumericOptions";
import type { ColumnEnumOptions } from "typeorm/decorator/options/ColumnEnumOptions";
import type { ColumnHstoreOptions } from "typeorm/decorator/options/ColumnHstoreOptions";
import type { ColumnEmbeddedOptions } from "typeorm/decorator/options/ColumnEmbeddedOptions";
import type { EmbeddedMetadataArgs } from "typeorm/metadata-args/EmbeddedMetadataArgs";
import { aggregateOrNewColumn } from "./utils";
import { DBKeys, InternalError, Repository } from "@decaf-ts/db-decorators";
import { Validation, ValidationKeys } from "@decaf-ts/decorator-validation";

/**
 * Column decorator is used to mark a specific class property as a table column. Only properties decorated with this
 * decorator will be persisted to the database when entity be saved.
 */
/**
 * @description Decorator to mark a class property as a database column.
 * @summary Provides multiple overloads to define column metadata such as type, length, precision, width, enum, set, hstore, and embedded types. Aggregates with existing metadata to avoid duplicates and delegates to TypeORM metadata storage.
 * @return {PropertyDecorator} A property decorator to be applied on an entity field.
 * @function Column
 * @memberOf module:for-typeorm
 */
export function Column(): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 */
export function Column(options: ColumnOptions): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 */
export function Column(
  type: SimpleColumnType,
  options?: ColumnCommonOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 */
export function Column(
  type: SpatialColumnType,
  options?: ColumnCommonOptions & SpatialColumnOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 */
export function Column(
  type: WithLengthColumnType,
  options?: ColumnCommonOptions & ColumnWithLengthOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType} type Type of the column.
 * @param {ColumnWithWidthOptions} [options] Options for the column.
 */
export function Column(
  type: WithWidthColumnType,
  options?: ColumnCommonOptions & ColumnWithWidthOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType} type Type of the column.
 * @param {ColumnNumericOptions} [options] Options for the column.
 */
export function Column(
  type: WithPrecisionColumnType,
  options?: ColumnCommonOptions & ColumnNumericOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType} type Type of the column.
 * @param {ColumnEnumOptions} [options] Options for the column.
 */
export function Column(
  type: "enum",
  options?: ColumnCommonOptions & ColumnEnumOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType} type Type of the column.
 * @param {ColumnEnumOptions} [options] Options for the column.
 */
export function Column(
  type: "simple-enum",
  options?: ColumnCommonOptions & ColumnEnumOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType} type Type of the column.
 * @param {ColumnEnumOptions} [options] Options for the column.
 */
export function Column(
  type: "set",
  options?: ColumnCommonOptions & ColumnEnumOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType} type Type of the column.
 * @param {ColumnHstoreOptions} [options] Options for the column.
 */
// @ts-expect-error some typeorm thing
export function Column(
  type: "hstore",
  options?: ColumnCommonOptions & ColumnHstoreOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 *
 * Property in entity can be marked as Embedded, and on persist all columns from the embedded are mapped to the
 * single table of the entity where Embedded is used. And on hydration all columns which supposed to be in the
 * embedded will be mapped to it from the single table.
 * @param {function(any): Function} type Type of the embedded.
 * @param {ColumnEmbeddedOptions} [options] Options for the embedded.
 */
export function Column(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  type: (type?: any) => Function,
  options?: ColumnEmbeddedOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * @param {ColumnType|ColumnOptions|function(any): Function} [typeOrOptions] Either an explicit column type or the column options.
 * @param {ColumnOptions} [options] The column options when a type is specified.
 * @return {PropertyDecorator} A property decorator to be applied on an entity field.
 */
export function Column(
  typeOrOptions?: // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  | ((type?: any) => Function)
    | ColumnType
    | (ColumnOptions & ColumnEmbeddedOptions),
  options?: ColumnOptions & ColumnEmbeddedOptions
): PropertyDecorator {
  return function (object: object, propertyName: any) {
    // normalize parameters
    let type: ColumnType | undefined;
    if (
      typeof typeOrOptions === "string" ||
      typeof typeOrOptions === "function"
    ) {
      type = <ColumnType>typeOrOptions;
    } else if (typeOrOptions) {
      options = <ColumnOptions>typeOrOptions;
      type = typeOrOptions.type;
    }
    if (!options) options = {} as ColumnOptions;

    // if type is not given explicitly then try to guess it
    let reflectMetadataType =
      Reflect && (Reflect as any).getMetadata
        ? (Reflect as any).getMetadata("design:type", object, propertyName)
        : undefined;
    if (!type && reflectMetadataType)
      // if type is not given explicitly then try to guess it
      type = reflectMetadataType;
    const forceTypes = Reflect.getMetadata(
      Validation.key(ValidationKeys.TYPE),
      object,
      propertyName
    );
    if (forceTypes) {
      const { customTypes } = forceTypes;
      const primaryType = Array.isArray(customTypes)
        ? customTypes[0]
        : customTypes;
      let dbType: any;
      switch (primaryType.toLowerCase()) {
        case "string":
          dbType = String;
          break;
        case "number":
          dbType = Number;
          break;
        case "bigint":
          dbType = BigInt;
          break;
        case "date":
          dbType = Date;
          break;
        default:
          dbType = primaryType;
      }

      type = dbType;
      reflectMetadataType = dbType;
    }

    // check if there is no type in column options then set type from first function argument, or guessed one
    if (!options.type && type) options.type = type;

    // specify HSTORE type if column is HSTORE
    if (options.type === "hstore" && !options.hstoreType)
      options.hstoreType = reflectMetadataType === Object ? "object" : "string";

    if (typeof typeOrOptions === "function") {
      // register an embedded
      getMetadataArgsStorage().embeddeds.push({
        target: object.constructor,
        propertyName: propertyName,
        isArray: reflectMetadataType === Array || options.array === true,
        prefix: options.prefix !== undefined ? options.prefix : undefined,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
        type: typeOrOptions as (type?: any) => Function,
      } as EmbeddedMetadataArgs);
    } else {
      // register a regular column

      // if we still don't have a type then we need to give error to user that type is required
      if (!options.type)
        throw new ColumnTypeUndefinedError(object, propertyName);

      // create unique
      if (options.unique === true)
        getMetadataArgsStorage().uniques.push({
          target: object.constructor,
          columns: [propertyName],
        });

      const metadata = getMetadataArgsStorage();
      aggregateOrNewColumn(
        object.constructor,
        propertyName,
        metadata.columns,
        options,
        "regular",
        metadata.relations,
        options.unique ? metadata.indices : undefined
      );

      if (options.generated) {
        getMetadataArgsStorage().generations.push({
          target: object.constructor,
          propertyName: propertyName,
          strategy:
            typeof options.generated === "string"
              ? options.generated
              : "increment",
        } as GeneratedMetadataArgs);
      }
    }
  };
}
