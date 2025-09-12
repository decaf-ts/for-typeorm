import {
  ColumnOptions,
  ColumnType,
  ColumnTypeUndefinedError,
  getMetadataArgsStorage,
  PrimaryColumnCannotBeNullableError,
} from "typeorm";
import type { GeneratedMetadataArgs } from "typeorm/metadata-args/GeneratedMetadataArgs";
import { aggregateOrNewColumn } from "./utils";

/**
 * Describes all primary key column's options.
 * If specified, the nullable field must be set to false.
 */
/**
 * @description Options for a primary key column.
 * @summary Extends TypeORM ColumnOptions enforcing that primary columns cannot be nullable.
 * @template T Extends ColumnOptions to define primary-specific options.
 * @interface PrimaryColumnOptions
 * @memberOf module:for-typeorm
 */
export type PrimaryColumnOptions = ColumnOptions & { nullable?: false };

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * Primary columns also creates a PRIMARY KEY for this column in a db.
 */
/**
 * @description Decorator to mark a property as a primary key column.
 * @summary Registers a non-nullable column as PRIMARY KEY in the underlying database. Supports optional type and generation strategies via ColumnOptions.
 * @param {PrimaryColumnOptions} [options] Column options when no explicit type is provided.
 * @return {PropertyDecorator} A property decorator to be applied on an entity field.
 * @function PrimaryColumn
 * @memberOf module:for-typeorm
 */
export function PrimaryColumn(
  options?: PrimaryColumnOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * Primary columns also creates a PRIMARY KEY for this column in a db.
 */
export function PrimaryColumn(
  type?: ColumnType,
  options?: PrimaryColumnOptions
): PropertyDecorator;

/**
 * Column decorator is used to mark a specific class property as a table column.
 * Only properties decorated with this decorator will be persisted to the database when entity be saved.
 * Primary columns also creates a PRIMARY KEY for this column in a db.
 */
/**
 * @description Decorator to mark a property as a primary key column with optional explicit type.
 * @summary Normalizes parameters, enforces non-nullability, sets primary flag, aggregates column metadata, and registers generation strategy when specified.
 * @param {ColumnType|PrimaryColumnOptions} [typeOrOptions] Either an explicit column type or the column options.
 * @param {PrimaryColumnOptions} [options] The column options when a type is specified.
 * @return {PropertyDecorator} A property decorator to be applied on an entity field.
 * @function PrimaryColumn
 * @memberOf module:for-typeorm
 * @mermaid
 * sequenceDiagram
 *   participant Dev as Developer Code
 *   participant Decor as PrimaryColumn
 *   participant Meta as TypeORM Metadata
 *   Dev->>Decor: @PrimaryColumn(typeOrOptions, options)
 *   Decor->>Dev: returns PropertyDecorator
 *   Dev->>Decor: apply on target property
 *   Decor->>Decor: normalize params, enforce non-nullable
 *   Decor->>Meta: aggregateOrNewColumn(...)
 *   alt options.generated
 *     Decor->>Meta: generations.push({ strategy })
 *   end
 */
export function PrimaryColumn(
  typeOrOptions?: ColumnType | PrimaryColumnOptions,
  options?: PrimaryColumnOptions
): PropertyDecorator {
  return function (object: any, propertyName: any) {
    // normalize parameters
    let type: ColumnType | undefined;
    if (
      typeof typeOrOptions === "string" ||
      typeOrOptions === String ||
      typeOrOptions === Boolean ||
      typeOrOptions === Number
    ) {
      type = typeOrOptions as ColumnType;
    } else {
      options = Object.assign({}, <PrimaryColumnOptions>typeOrOptions);
    }
    if (!options) options = {} as PrimaryColumnOptions;

    // if type is not given explicitly then try to guess it
    const reflectMetadataType =
      Reflect && (Reflect as any).getMetadata
        ? (Reflect as any).getMetadata("design:type", object, propertyName)
        : undefined;
    if (!type && reflectMetadataType) type = reflectMetadataType;

    // check if there is no type in column options then set type from first function argument, or guessed one
    if (!options.type && type) options.type = type;

    // if we still don't have a type then we need to give error to user that type is required
    if (!options.type) throw new ColumnTypeUndefinedError(object, propertyName);

    // check if column is not nullable, because we cannot allow a primary key to be nullable
    if (options.nullable)
      throw new PrimaryColumnCannotBeNullableError(object, propertyName);

    // explicitly set a primary to column options
    options.primary = true;

    const metadata = getMetadataArgsStorage();
    aggregateOrNewColumn(
      object.constructor,
      propertyName,
      metadata.columns,
      options,
      "regular",
      metadata.relations
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
  };
}
