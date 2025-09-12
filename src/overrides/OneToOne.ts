import { RelationOptions, getMetadataArgsStorage, ObjectType } from "typeorm";
import { ObjectUtils } from "./ObjectUtils";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { extractForRelations } from "./utils";

/**
 * One-to-one relation allows the creation of a direct relation between two entities. Entity1 has only one Entity2.
 * Entity1 is the owner of the relationship, and stores Entity2 id on its own side.
 * @template T
 * @param {string | function(any): ObjectType<T>} typeFunctionOrTarget
 * @param {string | function(T): any} inverseSideOrOptions
 * @param {RelationOptions} [options]
 */
export function OneToOne<T>(
  typeFunctionOrTarget: string | ((type?: any) => ObjectType<T>),
  inverseSideOrOptions?: string | ((object: T) => any) | RelationOptions,
  options?: RelationOptions
): PropertyDecorator {
  // normalize parameters
  let inverseSideProperty: string | ((object: T) => any);
  if (ObjectUtils.isObject(inverseSideOrOptions)) {
    options = <RelationOptions>inverseSideOrOptions;
  } else {
    inverseSideProperty = inverseSideOrOptions as any;
  }

  return function (object: any, propertyName: any) {
    if (!options) options = {} as RelationOptions;

    // now try to determine it its lazy relation
    let isLazy = options && options.lazy === true ? true : false;
    if (!isLazy && Reflect && (Reflect as any).getMetadata) {
      // automatic determination
      const reflectedType = (Reflect as any).getMetadata(
        "design:type",
        object,
        propertyName
      );
      if (
        reflectedType &&
        typeof reflectedType.name === "string" &&
        reflectedType.name.toLowerCase() === "promise"
      )
        isLazy = true;
    }

    const meta = getMetadataArgsStorage();
    options = Object.assign(
      options,
      extractForRelations(object.constructor, propertyName, meta.columns)
    );
    meta.relations.push({
      target: object.constructor,
      propertyName: propertyName,
      // propertyType: reflectedType,
      isLazy: isLazy,
      relationType: "one-to-one",
      type: typeFunctionOrTarget,
      inverseSideProperty: inverseSideProperty,
      options: options,
    } as RelationMetadataArgs);
  };
}
