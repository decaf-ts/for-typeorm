// import {
//   Constructor,
//   ModelKeys,
//   ValidationKeys,
// } from "@decaf-ts/decorator-validation";
//
// /**
//  * @description Default path splitter used to navigate nested metadata objects.
//  * @summary Keys in nested metadata are joined using this string to allow safe read/write by path.
//  * @const ObjectKeySplitter
//  * @memberOf module:for-typeorm
//  */
// export const ObjectKeySplitter = ".";
// /**
//  * @description Root key used to mirror model-associated metadata on the constructor.
//  * @summary When mirroring is enabled, a non-enumerable property with this key is attached to the model constructor to expose collected metadata.
//  * @const BaseKey
//  * @memberOf module:for-typeorm
//  */
// export const BaseKey = "decaf";
//
// /**
//  * @description Safely retrieves a nested value from an object using a path and splitter.
//  * @summary Splits the provided path by the splitter and walks the object, returning undefined if any intermediate key is missing, null, or undefined. Intended for internal metadata access.
//  * @param {Record<string, any>} obj The source object to read from.
//  * @param {string} path The path to resolve (e.g., "a.b.c").
//  * @param {string} [splitter=ObjectKeySplitter] The character(s) used to split the path.
//  * @return {any} The resolved value or undefined if not found.
//  * @function getValueBySplitter
//  * @category Decorators
//  * @mermaid
//  * sequenceDiagram
//  *   participant Fn as getValueBySplitter
//  *   participant Obj as Object
//  *   Fn->>Obj: split(path)
//  *   loop keys
//  *     Fn->>Obj: hasOwnProperty(key)?
//  *     alt missing/null/undefined
//  *       Fn-->>Obj: return undefined
//  *     else present
//  *       Fn->>Obj: current = current[key]
//  *     end
//  *   end
//  *   Fn-->>Obj: return current
//  */
// function getValueBySplitter(
//   obj: Record<string, any>,
//   path: string,
//   splitter: string = ObjectKeySplitter
// ): any {
//   const keys = path.split(splitter);
//   let current = obj;
//
//   for (const key of keys) {
//     if (
//       current === null ||
//       current === undefined ||
//       !Object.prototype.hasOwnProperty.call(current, key)
//     )
//       return undefined;
//     current = current[key];
//   }
//
//   return current;
// }
//
// /**
//  * @description Writes a nested value on an object using a path and splitter, creating missing objects along the way.
//  * @summary Ensures that all path segments exist and assigns the provided value at the terminal key. Intended for internal metadata mutation.
//  * @param {Record<string, any>} obj The target object to mutate.
//  * @param {string} path The path to set (e.g., "a.b.c").
//  * @param {any} value The value to assign.
//  * @param {string} [splitter=ObjectKeySplitter] The character(s) used to split the path.
//  * @return {void}
//  * @function setValueBySplitter
//  * @category Decorators
//  * @mermaid
//  * sequenceDiagram
//  *   participant Fn as setValueBySplitter
//  *   participant Obj as Object
//  *   Fn->>Obj: split(path)
//  *   loop keys
//  *     alt key missing
//  *       Fn->>Obj: current[key] = {}
//  *     end
//  *     Fn->>Obj: current = current[key]
//  *   end
//  *   Fn-->>Obj: current[lastKey] = value
//  */
// function setValueBySplitter(
//   obj: Record<string, any>,
//   path: string,
//   value: any,
//   splitter = ObjectKeySplitter
// ): void {
//   const keys = path.split(splitter);
//   let current: Record<any, any> = obj;
//
//   for (const key of keys) {
//     if (!(key in current)) {
//       current[key] = {};
//     }
//     current = current[key];
//   }
//
//   current[keys[keys.length - 1]] = value;
// }
//
// /**
//  * @description Structure of collected model metadata used by the TypeORM adapter decorators.
//  * @summary Captures property design types, validation metadata, relation mappings, generated fields, primary/foreign keys, and index specifications, which are mirrored onto the model constructor when enabled.
//  * @typedef ModelMetadata
//  * @property {Record<string, any>} properties Map of property names to their design-time types.
//  * @property {Record<string, any[]>} [validation] Optional validation rules grouped by validation key.
//  * @property {Record<string, any>} [relations] Optional relation metadata keyed by property.
//  * @property {Record<string, any>} [generated] Optional map of generated column strategies per property.
//  * @property {string} pk Primary key field name for the model.
//  * @property {Record<string, any>} [fks] Optional foreign key definitions keyed by property.
//  * @property {Record<string, any>} [indexes] Optional index definitions keyed by index name.
//  * @memberOf module:for-typeorm
//  */
// export type ModelMetadata = {
//   properties: Record<string, any>;
//   validation?: Record<string, any[]>;
//   relations?: Record<string, any>;
//   generated?: Record<string, any>;
//   pk: string;
//   fks?: Record<string, any>;
//   indexes?: Record<string, any>;
// };
//
// /**
//  * @description Central registry for model metadata used by decorators.
//  * @summary Provides static helpers to collect, mirror, and query metadata for models and their properties. It supports nested key access via a splitter, optional mirroring of metadata onto the model constructor, and utilities to infer design types combined with validation hints.
//  * @param {string} splitter The path splitter used to navigate nested metadata (see ObjectKeySplitter).
//  * @param {string} baseKey The non-enumerable key used to mirror metadata onto the model constructor.
//  * @param {boolean} mirror If true, metadata is mirrored on the model constructor under baseKey.
//  * @class Metadata
//  * @example
//  * class User {}
//  * // register a property type
//  * Metadata.set(User as any, `properties.id`, String);
//  * // read back
//  * const props = Metadata.getProperties(User as any); // ['id']
//  *
//  * @mermaid
//  * sequenceDiagram
//  *   participant Decor as Decorators
//  *   participant Store as Metadata Store
//  *   participant Model as Model Ctor
//  *   Decor->>Store: set(Model, "properties.email", String)
//  *   alt mirror enabled
//  *     Store->>Model: defineProperty(BaseKey, metadata)
//  *   end
//  *   Decor->>Store: getProperties(Model)
//  *   Store-->>Decor: ["email"]
//  */
// export class Metadata {
//   private static _metadata: Record<symbol, ModelMetadata> = {};
//
//   static splitter = ObjectKeySplitter;
//   static baseKey = BaseKey;
//   static mirror: boolean = true;
//
//   private constructor() {}
//
//   /**
//    * @description Lists all registered property names for a model.
//    * @summary Reads the metadata store for the given model and returns the keys of the properties map or undefined if none exist.
//    * @param {Constructor<any>} model The model constructor whose properties are requested.
//    * @return {string[]|undefined} Array of property names or undefined if no metadata exists.
//    */
//   static getProperties(model: Constructor<any>) {
//     const meta = this.get(model);
//     if (!meta) return undefined;
//     return Object.keys(meta.properties);
//   }
//
//   /**
//    * @description Retrieves the primary key field name for a model.
//    * @summary Returns the first key of the pk map in metadata, or undefined if no metadata is present.
//    * @param {Constructor<any>} model The model constructor.
//    * @return {string|undefined} The primary key field name or undefined.
//    */
//   static pk(model: Constructor<any>) {
//     const meta = this.get(model);
//     if (!meta) return undefined;
//     return Object.keys(meta.pk)[0];
//   }
//
//   /**
//    * @description Gets the first resolved type for a given model property.
//    * @summary Combines design-time metadata with optional validation-provided type hints and returns the first resolved type.
//    * @param {Constructor<any>} model The model constructor.
//    * @param {string} prop The property name to resolve the type for.
//    * @return {any} The first resolved type.
//    */
//   static type(model: Constructor<any>, prop: string) {
//     return this.types(model, prop)[0];
//   }
//
//   /**
//    * @description Resolves all known types for a given model property.
//    * @summary Returns an array containing the design-time type followed by any additional types derived from validation metadata.
//    * @param {Constructor<any>} model The model constructor.
//    * @param {string} prop The property name to resolve types for.
//    * @return {any[]} Ordered list of resolved types with falsy values removed.
//    */
//   static types(model: Constructor<any>, prop: string) {
//     let designType: any = this.get(model, `properties.${prop}`);
//     if (!designType)
//       throw new Error(`Property ${prop} not found in ${model.name}`);
//     designType = [designType];
//     const symbol = Symbol.for(model.toString());
//     if (this._metadata[symbol]) {
//       const meta = this._metadata[symbol];
//       if (meta.validation) {
//         const validation = meta.validation;
//         if (validation[ValidationKeys.TYPE])
//           designType = designType.concat(validation[ValidationKeys.TYPE]);
//       }
//     }
//     return designType.filter(Boolean);
//   }
//
//   /**
//    * @description Retrieves metadata or a nested value for a model.
//    * @summary When called with only the model, returns the entire ModelMetadata if it exists; when a key path is provided, returns the nested value resolved via the splitter.
//    * @param {Constructor<any>} model The model constructor.
//    * @param {string} [key] Optional dot-separated path to a nested value within the metadata.
//    * @return {ModelMetadata|any|undefined} The full metadata object, the nested value at key, or undefined if no metadata exists.
//    */
//   static get(model: Constructor<any>): ModelMetadata | undefined;
//   static get(model: Constructor<any>, key: string): any;
//   static get(model: Constructor<any>, key?: string) {
//     const symbol = Symbol.for(model.toString());
//     if (!this._metadata[symbol]) return undefined;
//     if (!key) return this._metadata[symbol];
//     return getValueBySplitter(this._metadata[symbol], key, this.splitter);
//   }
//
//   /**
//    * @description Assigns a value into the model's metadata at the provided key path.
//    * @summary Creates a metadata container if needed, mirrors it onto the model constructor when enabled, and sets the nested value using the current splitter.
//    * @param {Constructor<any>} model The model constructor.
//    * @param {string} key Dot-separated path within the metadata object.
//    * @param {any} value The value to assign at the path.
//    * @return {void}
//    */
//   static set(model: Constructor<any>, key: string, value: any) {
//     const symbol = Symbol.for(model.toString());
//     if (!this._metadata[symbol]) this._metadata[symbol] = {} as any;
//     if (
//       this.mirror &&
//       !Object.prototype.hasOwnProperty.call(model, this.baseKey)
//     ) {
//       Object.defineProperty(model, this.baseKey, {
//         enumerable: false,
//         configurable: false,
//         writable: false,
//         value: this._metadata[symbol],
//       });
//     }
//     setValueBySplitter(this._metadata[symbol], key, value, this.splitter);
//   }
// }
//
// /**
//  * @description Decorator factory that assigns a value into model metadata at a given key.
//  * @summary Returns a decorator usable on classes or properties that writes the provided value under the specified key path for the owning model constructor.
//  * @param {string} key The dot-separated metadata path to assign.
//  * @param {any} value The value to assign.
//  * @return {function(object, any, PropertyDescriptor): void} The decorator function.
//  * @function assign
//  * @category Decorators
//  * @mermaid
//  * sequenceDiagram
//  *   participant Dev as Developer Code
//  *   participant Fn as assign(key, value)
//  *   participant Decor as Decorator
//  *   Dev->>Fn: call with key, value
//  *   Fn-->>Dev: returns Decorator
//  *   Dev->>Decor: apply on class/property
//  *   Decor->>Metadata: Metadata.set(model, key, value)
//  */
// export function assign(key: string, value: any) {
//   return function assign(
//     model: object,
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     prop?: any,
//     // eslint-disable-next-line @typescript-eslint/no-unused-vars
//     descriptor?: PropertyDescriptor
//   ) {
//     Metadata.set(model as any, key, value);
//   };
// }
//
// /**
//  * @description Decorator factory to register a property design type in model metadata.
//  * @summary Uses Reflect metadata to discover the property's design type, then delegates to assign to persist it under properties.<prop>.
//  * @return {function(object, any): void} The decorator function.
//  * @function property
//  * @category Decorators
//  */
// export function property() {
//   return function property(model: object, prop: any) {
//     const designType = Reflect.getOwnMetadata(ModelKeys.TYPE, model, prop);
//     return assign(`property.${prop}`, designType)(model, prop);
//   };
// }
