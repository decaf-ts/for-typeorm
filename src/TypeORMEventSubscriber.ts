import {
  EntitySubscriberInterface,
  EventSubscriber,
  InsertEvent,
  RemoveEvent,
  UpdateEvent,
} from "typeorm";
import { Adapter, ContextualArgs, EventIds } from "@decaf-ts/core";
import { InternalError, OperationKeys } from "@decaf-ts/db-decorators";
import { Constructor } from "@decaf-ts/decoration";
import { TypeORMContext } from "./TypeORMAdapter";

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
  constructor(
    protected adapter: Adapter<any, any, any, TypeORMContext>,
    protected readonly handler: (
      tableName: string | Constructor,
      operation: OperationKeys,
      ids: EventIds,
      ...args: ContextualArgs<TypeORMContext>
    ) => void
  ) {
    if (!this.adapter)
      throw new InternalError(`Missing adapter. Should not be possible`);
  }

  /**
   * @description Handles post-insert events.
   * @summary Notifies observers about a create operation for the inserted entity.
   * @param {InsertEvent<any>} event The TypeORM insert event.
   * @return {Promise<any>|void} A promise when async or void otherwise.
   */
  async afterInsert(event: InsertEvent<any>): Promise<any> {
    const constructor = event.entity.constructor;
    const ctx = await this.adapter.context(
      OperationKeys.CREATE,
      {},
      constructor
    );
    this.handler(
      constructor,
      OperationKeys.CREATE,
      [event.entityId as any],
      ctx
    );
  }

  /**
   * @description Handles post-remove events.
   * @summary Notifies observers about a delete operation for the removed entity.
   * @param {RemoveEvent<any>} event The TypeORM remove event.
   * @return {Promise<any>|void} A promise when async or void otherwise.
   */
  async afterRemove(event: RemoveEvent<any>): Promise<any> {
    const constructor = event.entity.constructor;
    const ctx = await this.adapter.context(
      OperationKeys.CREATE,
      {},
      constructor
    );
    this.handler(
      constructor,
      OperationKeys.DELETE,
      [event.entityId as any],
      ctx
    );
  }

  /**
   * @description Handles post-update events.
   * @summary Notifies observers about an update operation for the modified entity.
   * @param {UpdateEvent<any>} event The TypeORM update event.
   * @return {Promise<any>|void} A promise when async or void otherwise.
   */
  async afterUpdate(event: UpdateEvent<any>): Promise<any> {
    const constructor = event.databaseEntity.constructor;
    const ctx = await this.adapter.context(
      OperationKeys.CREATE,
      {},
      constructor
    );
    return this.handler(
      constructor,
      OperationKeys.UPDATE,
      [(event.entity as any)["id"] as any],
      ctx
    );
  }
}
