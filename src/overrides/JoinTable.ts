import { getMetadataArgsStorage, JoinTableOptions } from "typeorm";
import { JoinTableMultipleColumnsOptions } from "typeorm/decorator/options/JoinTableMultipleColumnsOptions";
import { JoinTableMetadataArgs } from "typeorm/metadata-args/JoinTableMetadataArgs";

/**
 * JoinTable decorator is used in many-to-many relationship to specify owner side of relationship.
 * Its also used to set a custom junction table's name, column names and referenced columns.
 */
export function JoinTable(): PropertyDecorator;

/**
 * JoinTable decorator is used in many-to-many relationship to specify owner side of relationship.
 * Its also used to set a custom junction table's name, column names and referenced columns.
 */
export function JoinTable(options: JoinTableOptions): PropertyDecorator;

/**
 * JoinTable decorator is used in many-to-many relationship to specify owner side of relationship.
 * Its also used to set a custom junction table's name, column names and referenced columns.
 */
export function JoinTable(
  options: JoinTableMultipleColumnsOptions
): PropertyDecorator;

/**
 * JoinTable decorator is used in many-to-many relationship to specify owner side of relationship.
 * Its also used to set a custom junction table's name, column names and referenced columns.
 */
export function JoinTable(
  options?: JoinTableOptions | JoinTableMultipleColumnsOptions
): PropertyDecorator {
  return function (object: any, propertyName: any) {
    options =
      options || ({} as JoinTableOptions | JoinTableMultipleColumnsOptions);
    getMetadataArgsStorage().joinTables.push({
      target: object.constructor,
      propertyName: propertyName,
      name: options.name,
      joinColumns: (options && (options as JoinTableOptions).joinColumn
        ? [(options as JoinTableOptions).joinColumn!]
        : (options as JoinTableMultipleColumnsOptions).joinColumns) as any,
      inverseJoinColumns: (options &&
      (options as JoinTableOptions).inverseJoinColumn
        ? [(options as JoinTableOptions).inverseJoinColumn!]
        : (options as JoinTableMultipleColumnsOptions)
            .inverseJoinColumns) as any,
      schema: options && options.schema ? options.schema : undefined,
      database: options && options.database ? options.database : undefined,
      synchronize: !(options && options.synchronize === false),
    } as JoinTableMetadataArgs);
  };
}
