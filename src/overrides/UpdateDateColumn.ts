import { ColumnOptions, getMetadataArgsStorage } from "typeorm";
import { aggregateOrNewColumn } from "./utils";

/**
 * @description Decorator to mark a property as an auto-managed update timestamp column.
 * @summary Registers a column that will be automatically updated by the database/ORM whenever the row is modified. Wraps TypeORM metadata registration to aggregate with existing column metadata when present.
 * @param {ColumnOptions} [options] Optional TypeORM column options.
 * @return {PropertyDecorator} A property decorator to be applied on an entity field.
 * @function UpdateDateColumn
 * @memberOf module:for-typeorm
 * @mermaid
 * sequenceDiagram
 *   participant Dev as Developer Code
 *   participant Decor as UpdateDateColumn
 *   participant Meta as TypeORM Metadata
 *   Dev->>Decor: @UpdateDateColumn(options)
 *   Decor->>Dev: returns PropertyDecorator
 *   Dev->>Decor: apply on target property
 *   Decor->>Meta: aggregateOrNewColumn(..., "updateDate", ...)
 *   Meta-->>Decor: column metadata updated
 */
export function UpdateDateColumn(options?: ColumnOptions): PropertyDecorator {
  return function (object: any, propertyName: any) {
    const metadata = getMetadataArgsStorage();
    aggregateOrNewColumn(
      object.constructor,
      propertyName,
      metadata.columns,
      options || {},
      "updateDate",
      metadata.relations
    );
  };
}
