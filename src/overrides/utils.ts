import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";

export function aggregateOrNewColumn(
  target: any,
  property: string,
  columns: ColumnMetadataArgs[],
  options: any = {},
  mode: string = "regular"
) {
  columns = columns.filter(
    (c: ColumnMetadataArgs) =>
      c.target === target && c.propertyName === property
  );

  if (columns.length > 1)
    throw new Error(
      `Multiple columns for ${property} found for given target: ${columns.map((c) => c.propertyName).join(", ")}`
    );

  if (columns.length === 0) {
    columns.push({
      target: target,
      propertyName: property,
      mode: mode,
      options: options,
    } as ColumnMetadataArgs);
    return;
  }

  const column = columns[0];
  Object.defineProperty(column, "options", {
    value: { ...column.options, ...options },
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
