import { ColumnOptions, getMetadataArgsStorage } from "typeorm";
import { aggregateOrNewColumn } from "./utils";

export function CreateDateColumn(options?: ColumnOptions): PropertyDecorator {
  return function (object: any, propertyName: any) {
    const columns = getMetadataArgsStorage().columns;
    aggregateOrNewColumn(
      object.constructor,
      propertyName,
      columns,
      options || {},
      "createDate"
    );
  };
}
