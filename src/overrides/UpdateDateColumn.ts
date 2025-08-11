import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { ColumnOptions, getMetadataArgsStorage } from "typeorm";

export function UpdateDateColumn(options?: ColumnOptions): PropertyDecorator {
  return function (object: any, propertyName: any) {
    const columns = getMetadataArgsStorage().columns;
    const existing = columns.find(
      (r) => r.target === object.constructor && r.propertyName === propertyName
    );
    if (existing) {
      if (options)
        Object.defineProperty(existing, "options", {
          value: { ...existing.options, ...options },
          writable: true,
          enumerable: true,
          configurable: true,
        });
    } else {
      columns.push({
        target: object.constructor,
        propertyName: propertyName,
        mode: "updateDate",
        options: options ? options : {},
      } as ColumnMetadataArgs);
    }
  };
}
