import { PersistenceKeys, Repository } from "@decaf-ts/core";
import { Reflection } from "@decaf-ts/reflection";
import { InternalError } from "@decaf-ts/db-decorators";
import { Constructor, Model } from "@decaf-ts/decorator-validation";
import { Logging } from "@decaf-ts/logging";

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
  const instance = new m();
  const rels = Repository.relations(m);
  const log = Logging.for(splitEagerRelations);
  cache[m.name] = cache[m.name] || undefined;
  if (cache[m.name]) {
    log.info(`Returning cached relations for ${m.name}`);
    return cache[m.name];
  }
  const relations = rels.reduce(
    (accum: { relations: string[]; nonEager: string[] }, attr) => {
      log.info(`Retrieving decorators for property ${attr} on model ${m.name}`);
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
      log.info(
        `Decorators found: ${JSON.stringify(decorators.decorators, null, 2)}`
      );
      const decorator: any = decorators.decorators[0];
      const eager = decorator.props.populate;
      let clazz = decorator.props.class;
      if (typeof clazz === "function" && !clazz.name) {
        clazz = clazz();
      }

      log.info(
        `Relation on prop ${attr} of ${m.name} found: ${clazz.name} with eager: ${eager}`
      );

      if (!eager) {
        accum.nonEager.push(attr);
      } else {
        accum.relations.push(attr);
      }

      if (accum.relations.includes(attr)) {
        log.info(
          `Getting relations for ${clazz.name} in prop ${attr} of ${m.name} with eager: ${eager}`
        );
        const { nonEager, relations } = splitEagerRelations(clazz, cache);
        log.info(
          `Relations for ${attr} of ${clazz.name}: ${JSON.stringify(relations, null, 2)}`
        );
        log.info(
          `Non eager for ${attr} of ${clazz.name}: ${JSON.stringify(nonEager, null, 2)}`
        );
        if (nonEager.length && accum.relations.includes(attr)) {
          const nonEagerRelations = nonEager.map((ne) => `${attr}.${ne}`);
          accum.nonEager.push(...nonEagerRelations);
        }

        if (relations.length) {
          const rels = relations.map((ne) => `${attr}.${ne}`);
          accum.relations.push(...rels);
        }
        log.info(
          `calculated Relations for ${attr} of ${clazz.name}: ${JSON.stringify(relations, null, 2)}`
        );
        log.info(
          `calculated Non eager for ${attr} of ${clazz.name}: ${JSON.stringify(nonEager, null, 2)}`
        );
      }

      return accum;
    },
    { nonEager: [], relations: [] }
  );
  cache[m.name] = relations;
  Logging.for(splitEagerRelations).info(
    `Relations for ${m.name}: ${JSON.stringify(relations, null, 2)}`
  );
  return relations;
}
