import { Dispatch, EventIds } from "@decaf-ts/core";
import { InternalError, OperationKeys } from "@decaf-ts/db-decorators";
import { TypeORMAdapter } from "./TypeORMAdapter";
import { TypeORMEventSubscriber } from "./TypeORMEventSubscriber";

/**
 * @description Dispatcher for TypeORM-driven change events.
 * @summary Subscribes a TypeORM DataSource with a custom EntitySubscriber to notify observers when records are created, updated, or deleted.
 * @param {number} [timeout=5000] Timeout in milliseconds for initialization retries.
 * @class TypeORMDispatch
 * @example
 * // Create a dispatcher for a TypeORM DataSource
 * const dispatch = new TypeORMDispatch();
 * await dispatch.observe(adapter, adapter.dataSource.options);
 *
 * // The dispatcher registers a TypeORMEventSubscriber and notifies observers when entities change.
 * @mermaid
 * classDiagram
 *   class Dispatch {
 *     +initialize()
 *     +updateObservers()
 *   }
 *   class TypeORMDispatch {
 *     -observerLastUpdate?: string
 *     -attemptCounter: number
 *     -timeout: number
 *     +constructor(timeout)
 *     #notificationHandler()
 *     #initialize()
 *   }
 *   Dispatch <|-- TypeORMDispatch
 */
export class TypeORMDispatch extends Dispatch {
  private observerLastUpdate?: string;
  private attemptCounter: number = 0;

  constructor(private timeout = 5000) {
    super();
  }

  /**
   * @description Processes TypeORM notification events.
   * @summary Handles change notifications (translated from TypeORM events) and notifies observers about record changes.
   * @param {string} table The notification payload.
   * @param {OperationKeys} operation The notification payload.
   * @param {EventIds} ids The notification payload.
   * @return {Promise<void>} A promise that resolves when all notifications have been processed.
   * @mermaid
   * sequenceDiagram
   *   participant D as PostgreSQLDispatch
   *   participant L as Logger
   *   participant O as Observers
   *   Note over D: Receive notification from PostgreSQL
   *   D->>D: Parse notification payload
   *   D->>D: Extract table, operation, and ids
   *   D->>O: updateObservers(table, operation, ids)
   *   D->>D: Update observerLastUpdate
   *   D->>L: Log successful dispatch
   */
  protected async notificationHandler(
    table: string,
    operation: OperationKeys,
    ids: EventIds
  ): Promise<void> {
    const log = this.log.for(this.notificationHandler);
    try {
      // Notify observers
      await this.updateObservers(table, operation, ids);
      this.observerLastUpdate = new Date().toISOString();
      log.verbose(`Observer refresh dispatched by ${operation} for ${table}`);
      log.debug(`pks: ${ids}`);
    } catch (e: unknown) {
      log.error(`Failed to process notification: ${e}`);
    }
  }

  /**
   * @description Initializes the dispatcher and subscribes to TypeORM notifications.
   * @summary Registers the TypeORMEventSubscriber on the DataSource and logs the subscription lifecycle.
   * @return {Promise<void>} A promise that resolves when the subscription is established.
   * @mermaid
   * sequenceDiagram
   *   participant D as TypeORMDispatch
   *   participant S as subscribeToTypeORM
   *   participant DS as TypeORM DataSource
   *   participant L as Logger
   *   D->>S: Call subscribeToTypeORM
   *   S->>S: Check adapter and native
   *   alt No adapter or native
   *     S-->>S: throw InternalError
   *   end
   *   S->>DS: initialize()
   *   S->>DS: subscribers.push(TypeORMEventSubscriber)
   *   alt Success
   *     DS-->>S: Subscription established
   *     S-->>D: Promise resolves
   *     D->>L: Log successful subscription
   *   else Error
   *     DS-->>S: Error
   *     S-->>D: Promise rejects
   *   end
   */
  protected override async initialize(): Promise<void> {
    async function subscribeToTypeORM(this: TypeORMDispatch): Promise<void> {
      if (!this.adapter) {
        throw new InternalError(`No adapter/native observed for dispatch`);
      }

      const adapter = this.adapter as TypeORMAdapter;

      try {
        if (!adapter.client.isInitialized) await adapter.client.initialize();

        adapter.client.subscribers.push(
          new TypeORMEventSubscriber(this.notificationHandler.bind(this))
        );
      } catch (e: unknown) {
        throw new InternalError(e as Error);
      }
    }

    subscribeToTypeORM
      .call(this)
      .then(() => {
        this.log.info(`Subscribed to TypeORM notifications`);
      })
      .catch((e: unknown) => {
        throw new InternalError(
          `Failed to subscribe to TypeORM notifications: ${e}`
        );
      });
  }
}
