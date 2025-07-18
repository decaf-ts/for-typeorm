import {
  Decoration,
  model,
  Model,
  modelBaseDecorator,
  ModelKeys,
  propMetadata,
  required,
} from "@decaf-ts/decorator-validation";
import { TypeORMFlavour } from "./constants";
import { Entity } from "typeorm";

// @model()
const modelKey = Model.key(ModelKeys.MODEL);
Decoration.flavouredAs(TypeORMFlavour)
  .for(modelKey)
  .define(Entity(), modelBaseDecorator)
  .apply();
//
// const pkKey = Repository.key(DBKeys.ID);
//
// Decoration.flavouredAs(TypeORMFlavour)
//   .for(pkKey)
//   .define(required(), readonly(), propMetadata(pkKey, DefaultSequenceOptions));
//
// Decoration.flavouredAs(TypeORMFlavour)
//   .for(pkKey)
//   .define(required(), readonly(), propMetadata(pkKey, DefaultSequenceOptions));
