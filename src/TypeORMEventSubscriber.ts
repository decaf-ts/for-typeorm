import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from "typeorm";
import { Repository, table } from "@decaf-ts/core";
import { InternalError, OperationKeys } from "@decaf-ts/db-decorators";
import { TypeORMAdapter } from "./TypeORMAdapter";
import { Model, ModelKeys } from "@decaf-ts/decorator-validation";

@EventSubscriber()
export class TypeORMEventSubscriber implements EntitySubscriberInterface {
  constructor(protected readonly adapter: TypeORMAdapter) {}

  afterInsert(event: InsertEvent<any>): Promise<any> | void {
    const constructor = Model.get(event.entity.constructor.name);
    if (!constructor)
      throw new InternalError(
        `No registered model found for ${event.entity.constructor.name}`
      );
    const tableName = Repository.table(constructor);

    return this.adapter.updateObservers(tableName, OperationKeys.CREATE, [
      event.entityId as any,
    ]);
  }

  afterRemove(event: RemoveEvent<any>): Promise<any> | void {
    const constructor = Model.get(event.entity.constructor.name);
    if (!constructor)
      throw new InternalError(
        `No registered model found for ${event.entity.constructor.name}`
      );
    const tableName = Repository.table(constructor);

    return this.adapter.updateObservers(tableName, OperationKeys.DELETE, [
      event.entityId as any,
    ]);
  }

  afterUpdate(event: UpdateEvent<any>): Promise<any> | void {
    const constructor = Model.get(event.databaseEntity.constructor.name);
    if (!constructor)
      throw new InternalError(
        `No registered model found for ${event.databaseEntity.constructor.name}`
      );
    const tableName = Repository.table(constructor);

    return this.adapter.updateObservers(tableName, OperationKeys.UPDATE, [
      (event.entity as any)["id"] as any,
    ]);
  }
}
