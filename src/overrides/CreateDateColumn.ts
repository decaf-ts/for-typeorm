import { ColumnOptions, getMetadataArgsStorage } from "typeorm";
import { aggregateOrNewColumn } from "./utils";

/**
 * @description Decorator to mark a property as an auto-managed creation timestamp column.
 * @summary Registers a column that will be automatically set by the database/ORM when the row is first created. Wraps TypeORM metadata registration to aggregate with existing column metadata when present.
 * @param {ColumnOptions} [options] Optional TypeORM column options.
 * @return {PropertyDecorator} A property decorator to be applied on an entity field.
 * @function CreateDateColumn
 * @memberOf module:for-typeorm
 * @mermaid
 * sequenceDiagram
 *   participant Dev as Developer Code
 *   participant Decor as CreateDateColumn
 *   participant Meta as TypeORM Metadata
 *   Dev->>Decor: @CreateDateColumn(options)
 *   Decor->>Dev: returns PropertyDecorator
 *   Dev->>Decor: apply on target property
 *   Decor->>Meta: aggregateOrNewColumn(..., "createDate", ...)
 *   Meta-->>Decor: column metadata updated
 */
export function CreateDateColumn(options?: ColumnOptions): PropertyDecorator {
  return function (object: any, propertyName: any) {
    const metadata = getMetadataArgsStorage();
    aggregateOrNewColumn(
      object.constructor,
      propertyName,
      metadata.columns,
      options || {},
      "createDate",
      metadata.relations
    );
  };
}
