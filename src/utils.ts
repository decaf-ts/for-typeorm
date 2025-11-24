import { ExtendedRelationsMetadata } from "@decaf-ts/core";
import { InternalError } from "@decaf-ts/db-decorators";
import { Constructor, Metadata } from "@decaf-ts/decoration";
import { Model } from "@decaf-ts/decorator-validation";
import { isClass } from "@decaf-ts/logging";

/**
 * @description Converts a JavaScript RegExp pattern to a PostgreSQL POSIX pattern string.
 * @summary Accepts either a RegExp object or a string representation (/pattern/flags) and returns the raw pattern compatible with PostgreSQL's ~ and ~* operators.
 * @param {RegExp|string} jsRegex JavaScript RegExp object or pattern string.
 * @return {string} PostgreSQL-compatible regex pattern string.
 * @function convertJsRegexToPostgres
 * @mermaid
 * sequenceDiagram
 *   participant App
 *   participant Utils as convertJsRegexToPostgres
 *   App->>Utils: convertJsRegexToPostgres(RegExp("foo.*","i"))
 *   Utils->>Utils: Parse string or use RegExp.source
 *   Utils-->>App: "foo.*"
 * @memberOf module:for-typeorm
 */
export function convertJsRegexToPostgres(jsRegex: RegExp | string): string {
  const rxp = new RegExp(/^\/(.+)\/(\w+)$/g);
  if (typeof jsRegex === "string") {
    const match = rxp.exec(jsRegex);
    if (match) {
      const [, p] = match;
      jsRegex = p;
    }
  }
  const regex = typeof jsRegex === "string" ? new RegExp(jsRegex) : jsRegex;

  const pattern = regex.source;

  return pattern;
}

export function splitEagerRelations<M extends Model>(
  m: Constructor<M>,
  cache: Record<string, any> = {}
): { nonEager: string[]; relations: string[] } {
  const rels = Model.relations(m);
  cache[m.name] = cache[m.name] || undefined;
  if (cache[m.name]) {
    return cache[m.name];
  }
  const relations = rels.reduce(
    (accum: { relations: string[]; nonEager: string[] }, attr) => {
      const decorator: ExtendedRelationsMetadata = Metadata.relations(
        m,
        attr as any
      );

      const eager = decorator.populate;
      let clazz = decorator.class;
      if (!isClass(clazz)) clazz = clazz();
      if (!clazz)
        throw new InternalError(
          `Could not find class for property ${attr} on model ${m.name}`
        );

      if (!eager) {
        accum.nonEager.push(attr);
      } else {
        accum.relations.push(attr);
      }

      if (accum.relations.includes(attr)) {
        const { nonEager, relations } = splitEagerRelations(clazz, cache);
        if (nonEager.length && accum.relations.includes(attr)) {
          const nonEagerRelations = nonEager.map((ne) => `${attr}.${ne}`);
          accum.nonEager.push(...nonEagerRelations);
        }

        if (relations.length) {
          const rels = relations.map((ne) => `${attr}.${ne}`);
          accum.relations.push(...rels);
        }
      }

      return accum;
    },
    { nonEager: [], relations: [] }
  );
  cache[m.name] = relations;
  return relations;
}
