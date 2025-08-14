import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";

export function aggregateOrNewColumn(
  target: any,
  property: string,
  columns: ColumnMetadataArgs[],
  options: any = {},
  mode: string = "regular"
) {
  const cols = columns.filter(
    (c: ColumnMetadataArgs) =>
      c.target === target && c.propertyName === property
  );

  if (cols.length > 1)
    throw new Error(
      `Multiple columns for ${property} found for given target: ${columns.map((c) => c.propertyName).join(", ")}`
    );

  if (cols.length === 0) {
    columns.push({
      target: target,
      propertyName: property,
      mode: mode,
      options: options,
    } as ColumnMetadataArgs);
    return;
  }

  const column = cols[0];
  Object.defineProperty(column, "options", {
    value: { ...column.options, ...options },
    writable: true,
    enumerable: true,
    configurable: true,
  });

  if (mode !== "regular")
    Object.defineProperty(column, "mode", {
      value: mode,
      writable: true,
      enumerable: true,
      configurable: true,
    });
}
