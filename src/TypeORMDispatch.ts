import { Dispatch } from "@decaf-ts/core";
import { PoolClient, Notification } from "pg";
import { InternalError, OperationKeys } from "@decaf-ts/db-decorators";
import { DataSource } from "typeorm";

/**
 * @description Dispatcher for PostgreSQL database change events
 * @summary Handles the subscription to and processing of database change events from a PostgreSQL database,
 * notifying observers when records are created, updated, or deleted
 * @template Pool - The pg Pool type
 * @param {number} [timeout=5000] - Timeout in milliseconds for notification requests
 * @class TypeORMDispatch
 * @example
 * ```typescript
 * // Create a dispatcher for a PostgreSQL database
 * const pool = new Pool({
 *   user: 'postgres',
 *   password: 'password',
 *   host: 'localhost',
 *   port: 5432,
 *   database: 'mydb'
 * });
 * const adapter = new PostgreSQLAdapterImpl(pool);
 * const dispatch = new PostgreSQLDispatch();
 *
 * // The dispatcher will automatically subscribe to notifications
 * // and notify observers when records change
 * ```
 * @mermaid
 * classDiagram
 *   class Dispatch {
 *     +initialize()
 *     +updateObservers()
 *   }
 *   class PostgreSQLDispatch {
 *     -observerLastUpdate?: string
 *     -attemptCounter: number
 *     -timeout: number
 *     -client?: PoolClient
 *     +constructor(timeout)
 *     #notificationHandler()
 *     #initialize()
 *   }
 *   Dispatch <|-- PostgreSQLDispatch
 */
export class TypeORMDispatch extends Dispatch<DataSource> {
  private observerLastUpdate?: string;
  private attemptCounter: number = 0;
  private client?: PoolClient;

  constructor(private timeout = 5000) {
    super();
  }

  /**
   * @description Processes database notification events
   * @summary Handles the notifications from PostgreSQL LISTEN/NOTIFY mechanism,
   * and notifies observers about record changes
   * @param {Notification} notification - The notification from PostgreSQL
   * @return {Promise<void>} A promise that resolves when all notifications have been processed
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
    notification: Notification
  ): Promise<void> {
    const log = this.log.for(this.notificationHandler);

    try {
      // Parse the notification payload (expected format: table:operation:id1,id2,...)
      const payload = notification.payload as string;
      const [table, operation, idsString] = payload.split(":");
      const ids = idsString.split(",");

      if (!table || !operation || !ids.length) {
        return log.error(`Invalid notification format: ${payload}`);
      }

      // Map operation string to OperationKeys
      let operationKey: OperationKeys;
      switch (operation.toLowerCase()) {
        case "insert":
          operationKey = OperationKeys.CREATE;
          break;
        case "update":
          operationKey = OperationKeys.UPDATE;
          break;
        case "delete":
          operationKey = OperationKeys.DELETE;
          break;
        default:
          return log.error(`Unknown operation: ${operation}`);
      }

      // Notify observers
      await this.updateObservers(table, operationKey, ids);
      this.observerLastUpdate = new Date().toISOString();
      log.verbose(`Observer refresh dispatched by ${operation} for ${table}`);
      log.debug(`pks: ${ids}`);
    } catch (e: unknown) {
      log.error(`Failed to process notification: ${e}`);
    }
  }

  /**
   * @description Initializes the dispatcher and subscribes to database notifications
   * @summary Sets up the LISTEN mechanism to subscribe to PostgreSQL notifications
   * and handles reconnection attempts if the connection fails
   * @return {Promise<void>} A promise that resolves when the subscription is established
   * @mermaid
   * sequenceDiagram
   *   participant D as PostgreSQLDispatch
   *   participant S as subscribeToPostgreSQL
   *   participant DB as PostgreSQL Database
   *   participant L as Logger
   *   D->>S: Call subscribeToPostgreSQL
   *   S->>S: Check adapter and native
   *   alt No adapter or native
   *     S-->>S: throw InternalError
   *   end
   *   S->>DB: Connect client from pool
   *   S->>DB: LISTEN table_changes
   *   alt Success
   *     DB-->>S: Subscription established
   *     S-->>D: Promise resolves
   *     D->>L: Log successful subscription
   *   else Error
   *     DB-->>S: Error
   *     S->>S: Increment attemptCounter
   *     alt attemptCounter > 3
   *       S->>L: Log error
   *       S-->>D: Promise rejects
   *     else attemptCounter <= 3
   *       S->>L: Log retry
   *       S->>S: Wait timeout
   *       S->>S: Recursive call to subscribeToPostgreSQL
   *     end
   *   end
   */
  protected override async initialize(): Promise<void> {
    const log = this.log.for(this.initialize);

    async function subscribeToPostgres(this: TypeORMDispatch): Promise<void> {
      if (!this.adapter || !this.native) {
        throw new InternalError(`No adapter/native observed for dispatch`);
      }

      try {
        if (!this.native.isInitialized) await this.native.initialize();
        //
        // this.client.on("notification", this.notificationHandler.bind(this));
        //
        // // Listen for table change notifications
        // // This assumes you have set up triggers in PostgreSQL to NOTIFY on table changes
        // const res = await this.client.query("LISTEN user_table_changes");

        this.attemptCounter = 0;
      } catch (e: unknown) {
        if (this.client) {
          this.client.release();
          this.client = undefined;
        }

        if (++this.attemptCounter > 3) {
          return log.error(
            `Failed to subscribe to Postgres notifications: ${e}`
          );
        }

        log.info(
          `Failed to subscribe to Postgres notifications: ${e}. Retrying in ${this.timeout}ms...`
        );

        await new Promise((resolve) => setTimeout(resolve, this.timeout));
        return subscribeToPostgres.call(this);
      }
    }

    subscribeToPostgres
      .call(this)
      .then(() => {
        this.log.info(`Subscribed to Postgres notifications`);
      })
      .catch((e: unknown) => {
        throw new InternalError(
          `Failed to subscribe to Postgres notifications: ${e}`
        );
      });
  }

  /**
   * Cleanup method to release resources when the dispatcher is no longer needed
   */
  public cleanup(): void {
    if (this.client) {
      this.client.release();
      this.client = undefined;
    }
  }
}
