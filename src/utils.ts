import { PersistenceKeys, Repository } from "@decaf-ts/core";
import { Reflection } from "@decaf-ts/reflection";
import { InternalError } from "@decaf-ts/db-decorators";
import { Constructor, Model } from "@decaf-ts/decorator-validation";

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
  let instance: M;
  try {
    instance = new m();
  } catch (e: unknown) {
    throw new InternalError(
      `Could not instantiate model ${m.name} for eager relation calculation: ${e}`
    );
  }
  const rels = Repository.relations(m);
  cache[m.name] = cache[m.name] || undefined;
  if (cache[m.name]) {
    return cache[m.name];
  }
  const relations = rels.reduce(
    (accum: { relations: string[]; nonEager: string[] }, attr) => {
      const decorators = Reflection.getPropertyDecorators(
        Repository.key(PersistenceKeys.RELATION),
        instance,
        attr,
        true
      );
      if (
        !decorators ||
        !decorators.decorators ||
        !decorators.decorators.length
      )
        throw new InternalError(
          `No decorators found for property ${attr} on model ${m.name}`
        );
      if (decorators.decorators.length > 1)
        throw new InternalError(
          `Multiple decorators found for property ${attr} on model ${m.name}`
        );
      const decorator: any = decorators.decorators[0];
      const eager = decorator.props.populate;
      let clazz = decorator.props.class;
      if (typeof clazz === "string") clazz = Model.get(clazz) as Constructor<M>;
      if (typeof clazz === "function" && !clazz.name) clazz = clazz();
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
