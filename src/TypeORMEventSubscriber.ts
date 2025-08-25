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

/**
 * @description TypeORM event subscriber that forwards entity lifecycle events to the adapter.
 * @summary Listens for insert, update, and remove events emitted by TypeORM and notifies the Decaf.ts adapter so that observers can be updated accordingly.
 * @param {TypeORMAdapter} adapter The TypeORM adapter used to propagate events and look up metadata.
 * @class
 * @example
 * // Registering the subscriber when creating a DataSource
 * // dataSourceOptions.subscribers = [new TypeORMEventSubscriber(adapter)];
 *
 * @mermaid
 * sequenceDiagram
 *   participant TypeORM
 *   participant Subscriber as TypeORMEventSubscriber
 *   participant Adapter as TypeORMAdapter
 *   participant Observers
 *
 *   TypeORM->>Subscriber: afterInsert(entity)
 *   Subscriber->>Adapter: updateObservers(table, CREATE, [id])
 *   Adapter->>Observers: notify(table, CREATE, [id])
 *
 *   TypeORM->>Subscriber: afterUpdate(event)
 *   Subscriber->>Adapter: updateObservers(table, UPDATE, [id])
 *   Adapter->>Observers: notify(table, UPDATE, [id])
 *
 *   TypeORM->>Subscriber: afterRemove(event)
 *   Subscriber->>Adapter: updateObservers(table, DELETE, [id])
 *   Adapter->>Observers: notify(table, DELETE, [id])
 */
@EventSubscriber()
export class TypeORMEventSubscriber implements EntitySubscriberInterface {
  constructor(protected readonly adapter: TypeORMAdapter) {}

  /**
   * @description Handles post-insert events.
   * @summary Notifies observers about a create operation for the inserted entity.
   * @param {InsertEvent<any>} event The TypeORM insert event.
   * @return {Promise<any>|void} A promise when async or void otherwise.
   */
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

  /**
   * @description Handles post-remove events.
   * @summary Notifies observers about a delete operation for the removed entity.
   * @param {RemoveEvent<any>} event The TypeORM remove event.
   * @return {Promise<any>|void} A promise when async or void otherwise.
   */
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

  /**
   * @description Handles post-update events.
   * @summary Notifies observers about an update operation for the modified entity.
   * @param {UpdateEvent<any>} event The TypeORM update event.
   * @return {Promise<any>|void} A promise when async or void otherwise.
   */
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
