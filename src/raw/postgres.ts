/**
 * @description Definition of a PostgreSQL result field.
 * @summary Describes metadata for a column returned in a PostgreSQL query result, including identifiers and type information.
 * @interface FieldDef
 * @memberOf module:for-typeorm
 */
export interface FieldDef {
  name: string;
  tableID: number;
  columnID: number;
  dataTypeID: number;
  dataTypeSize: number;
  dataTypeModifier: number;
  format: string;
}

/**
 * @description Base shape for PostgreSQL query results.
 * @summary Contains common properties present in all PostgreSQL query results such as the executed command, row count, oid, and fields metadata.
 * @interface QueryResultBase
 * @memberOf module:for-typeorm
 */
export interface QueryResultBase {
  command: string;
  rowCount: number | null;
  oid: number;
  fields: FieldDef[];
}

export interface QueryResultRow {
  [column: string]: any;
}

export interface QueryResult<R extends QueryResultRow = any>
  extends QueryResultBase {
  rows: R[];
}

export interface QueryArrayResult<R extends any[] = any[]>
  extends QueryResultBase {
  rows: R[];
}
