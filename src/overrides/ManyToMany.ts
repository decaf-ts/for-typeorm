import { RelationOptions, getMetadataArgsStorage, ObjectType } from "typeorm";
import { ObjectUtils } from "./ObjectUtils";
import { RelationMetadataArgs } from "typeorm/metadata-args/RelationMetadataArgs";
import { extractForRelations } from "./utils";

/**
 * Many-to-many is a type of relationship when Entity1 can have multiple instances of Entity2, and Entity2 can have
 * multiple instances of Entity1. To achieve it, this type of relation creates a junction table, where it storage
 * entity1 and entity2 ids. This is owner side of the relationship.
 * @template T
 * @param {string | function(any): ObjectType<T>} typeFunctionOrTarget
 * @param {string | function(T): any} inverseSideOrOptions
 * @param {RelationOptions} [options]
 */
export function ManyToMany<T>(
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
    let isLazy = options.lazy === true;
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
      relationType: "many-to-many",
      isLazy: isLazy,
      type: typeFunctionOrTarget,
      inverseSideProperty: inverseSideProperty,
      options: options,
    } as RelationMetadataArgs);
  };
}
