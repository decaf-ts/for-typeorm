import { GroupOperator, Operator } from "@decaf-ts/core";
import { TypeORMGroupOperator, TypeORMOperator } from "./constants";
import { QueryError } from "@decaf-ts/core";
import { SQLOperator } from "../types";

/**
 * @description Translates core operators to PostgreSQL SQL operators
 * @summary Converts Decaf.ts core operators to their equivalent PostgreSQL SQL operators
 * @param {GroupOperator | Operator} operator - The core operator to translate
 * @return {SQLOperator | string} The equivalent PostgreSQL SQL operator
 * @throws {QueryError} If no translation exists for the given operator
 * @function translateOperators
 * @memberOf module:for-postgres
 * @mermaid
 * sequenceDiagram
 *   participant Caller
 *   participant translateOperators
 *   participant PostgreSQLOperator
 *   participant PostgreSQLGroupOperator
 *
 *   Caller->>translateOperators: operator
 *
 *   translateOperators->>PostgreSQLOperator: Check for match
 *   alt Found in PostgreSQLOperator
 *     PostgreSQLOperator-->>translateOperators: Return matching operator
 *     translateOperators-->>Caller: Return SQLOperator
 *   else Not found
 *     translateOperators->>PostgreSQLGroupOperator: Check for match
 *     alt Found in PostgreSQLGroupOperator
 *       PostgreSQLGroupOperator-->>translateOperators: Return matching operator
 *       translateOperators-->>Caller: Return string
 *     else Not found
 *       translateOperators-->>Caller: Throw QueryError
 *     end
 *   end
 */
export function translateOperators(
  operator: GroupOperator | Operator
): SQLOperator | string {
  for (const operators of [TypeORMOperator, TypeORMGroupOperator]) {
    const el = Object.keys(operators).find((k) => k === operator);
    if (el) return operators[el];
  }
  throw new QueryError(
    `Could not find adapter translation for operator ${operator}`
  );
}
