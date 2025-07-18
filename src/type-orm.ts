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
import { Column, Entity, PrimaryGeneratedColumn } from "typeorm";
import {
  Adapter,
  DefaultSequenceOptions,
  Repository,
  PersistenceKeys,
} from "@decaf-ts/core";
import { DBKeys, readonly } from "@decaf-ts/db-decorators";

// @table() => @Entity()
const tableKey = Adapter.key(PersistenceKeys.COLUMN);
Decoration.flavouredAs(TypeORMFlavour)
  .for(tableKey)
  .extend(Entity())
  // .define(Entity(), modelBaseDecorator)
  .apply();

// @pk => @PrimaryGeneratedColumn()
const pkKey = Repository.key(DBKeys.ID);
Decoration.flavouredAs(TypeORMFlavour)
  .for(pkKey)
  // .define(required(), readonly(), propMetadata(pkKey, DefaultSequenceOptions));
  .extend(PrimaryGeneratedColumn())
  .apply();

// @column => @Column()
const columnKey = Adapter.key(PersistenceKeys.COLUMN);
Decoration.flavouredAs(TypeORMFlavour)
  .for(columnKey)
  .define(function column(type: string) {
    return Column(type);
  } as any)
  .apply();
//
// Decoration.flavouredAs(TypeORMFlavour)
//   .for(pkKey)
//   .define(required(), readonly(), propMetadata(pkKey, DefaultSequenceOptions));
