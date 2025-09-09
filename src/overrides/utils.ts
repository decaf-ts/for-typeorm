import { ColumnMetadataArgs } from "typeorm/metadata-args/ColumnMetadataArgs";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { InternalError } from "@decaf-ts/db-decorators";
import { UnsupportedError } from "@decaf-ts/core";
import { ValidationKeys } from "@decaf-ts/decorator-validation";
import { IndexMetadataArgs } from "typeorm/metadata-args/IndexMetadataArgs";

export function extractForRelations(
  target: any,
  property: string,
  columns: ColumnMetadataArgs[]
) {
  let index: number = 0;
  const cols = columns.filter((c: ColumnMetadataArgs, i) => {
    index = i;
    return c.target === target && c.propertyName === property;
  });
  if (!cols.length) return {};
  columns.splice(index, 1);
  return Object.entries(cols[0].options).reduce(
    (accum: Record<string, any>, [key, val]) => {
      switch (key) {
        case "nullable":
          accum[key] = val;
          break;
        case ValidationKeys.TYPE:
          // do nothing
          break;
        default:
          throw new UnsupportedError(
            `Unsupported option for a relation: ${key}`
          );
      }
      return accum;
    },
    {}
  );
}

export function aggregateOrNewColumn(
  target: any,
  property: string,
  columns: ColumnMetadataArgs[],
  options: any = {},
  mode: string = "regular",
  relations: RelationMetadataArgs[],
  indexes?: IndexMetadataArgs[]
) {
  const cols = columns.filter(
    (c: ColumnMetadataArgs) =>
      c.target === target && c.propertyName === property
  );

  const rels = relations.filter(
    (c: RelationMetadataArgs) =>
      c.target === target && c.propertyName === property
  );

  if (indexes) {
    const indx = indexes.filter(
      (c: IndexMetadataArgs) =>
        c.target === target && (c.columns as string[]).includes(property)
    );
    indx.forEach((i) => {
      Object.assign(i, options);
    });
  }

  if (cols.length > 1)
    throw new InternalError(
      `Multiple columns for ${property} found for given target: ${columns.map((c) => c.propertyName).join(", ")}`
    );
  if (rels.length > 1)
    throw new InternalError(
      `Multiple relations for ${property} found for given target: ${rels.map((c) => c.propertyName).join(", ")}`
    );
  let column: ColumnMetadataArgs | RelationMetadataArgs | undefined;

  if (cols.length === 0 && !rels.length) {
    columns.push({
      target: target,
      propertyName: property,
      mode: mode,
      options: options,
    } as ColumnMetadataArgs);
    return;
  } else if (!rels.length) {
    column = cols[0];
    if (mode !== "regular")
      Object.defineProperty(column, "mode", {
        value: mode,
        writable: true,
        enumerable: true,
        configurable: true,
      });
  }

  if (rels.length)
    options = Object.entries(options).reduce(
      (accum: Record<string, any>, [key, val]) => {
        switch (key) {
          case "nullable":
            accum[key] = val;
            break;
          default:
          // do nothing
        }
        return accum;
      },
      {}
    );

  column = column || rels[0];

  Object.defineProperty(column, "options", {
    value: { ...column.options, ...options },
    writable: true,
    enumerable: true,
    configurable: true,
  });
}
