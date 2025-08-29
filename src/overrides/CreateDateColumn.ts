import { ColumnOptions, getMetadataArgsStorage } from "typeorm";
import { aggregateOrNewColumn } from "./utils";

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
