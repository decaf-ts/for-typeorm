import { EntityOptions, getMetadataArgsStorage } from "typeorm";
import type { TableMetadataArgs } from "typeorm/metadata-args/TableMetadataArgs";
import { ObjectUtils } from "./ObjectUtils";

/**
 * This decorator is used to mark classes that will be an entity (table or document depend on database type).
 * Database schema will be created for all classes decorated with it, and Repository can be retrieved and used for it.
 */
export function Entity(options?: EntityOptions): ClassDecorator;

/**
 * This decorator is used to mark classes that will be an entity (table or document depend on database type).
 * Database schema will be created for all classes decorated with it, and Repository can be retrieved and used for it.
 */
export function Entity(name?: string, options?: EntityOptions): ClassDecorator;

/**
 * This decorator is used to mark classes that will be an entity (table or document depend on database type).
 * Database schema will be created for all classes decorated with it, and Repository can be retrieved and used for it.
 */
export function Entity(
  nameOrOptions?: string | EntityOptions,
  maybeOptions?: EntityOptions
): ClassDecorator {
  const options =
    (ObjectUtils.isObject(nameOrOptions)
      ? (nameOrOptions as EntityOptions)
      : maybeOptions) || {};
  const name = typeof nameOrOptions === "string" ? nameOrOptions : options.name;

  return function (target) {
    const tables = getMetadataArgsStorage().tables;
    tables.push({
      target: target,
      name: name,
      type: "regular",
      orderBy: options.orderBy ? options.orderBy : undefined,
      engine: options.engine ? options.engine : undefined,
      database: options.database ? options.database : undefined,
      schema: options.schema ? options.schema : undefined,
      synchronize: options.synchronize,
      withoutRowid: options.withoutRowid,
      comment: options.comment ? options.comment : undefined,
    } as TableMetadataArgs);
  };
}
