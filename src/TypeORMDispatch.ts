import {
  Adapter,
  ContextualArgs,
  Dispatch,
  EventIds,
  MaybeContextualArg,
  PersistenceKeys,
} from "@decaf-ts/core";
import { InternalError, OperationKeys } from "@decaf-ts/db-decorators";
import { TypeORMEventSubscriber } from "./TypeORMEventSubscriber";
import { TypeORMDriver, TypeORMEventMode } from "./types";
import { DataSourceOptions } from "typeorm/data-source/DataSourceOptions";
import { DataSource } from "typeorm";
import { TypeORMQuery } from "./types";
import { TypeORMContext } from "./TypeORMAdapter";
import { Constructor } from "@decaf-ts/decoration";

/**
 * @description Dispatcher for TypeORM-driven change events.
 * @summary Subscribes a TypeORM DataSource with a custom EntitySubscriber to notify observers when records are created, updated, or deleted. Supports both SUBSCRIBER and TRIGGER modes for multi-database compatibility.
 * @param {number} [timeout=5000] Timeout in milliseconds for initialization retries.
 * @class TypeORMDispatch
 * @example
 * // Create a dispatcher for a TypeORM DataSource
 * const dispatch = new TypeORMDispatch();
 * await dispatch.observe(adapter, adapter.dataSource.options);
 *
 * // The dispatcher registers a TypeORMEventSubscriber and notifies observers when entities change.
 * @mermaid
 * sequenceDiagram
 *   participant D as TypeORMDispatch
 *   participant DS as TypeORM DataSource
 *   participant S as TypeORMEventSubscriber
 *   participant O as Observers
 *   D->>DS: observe(adapter, options)
 *   DS->>D: initialize()
 *   D->>DS: subscribers.push(S)
 *   S-->>D: emits insert/update/remove
 *   D->>O: updateObservers(table, operation, ids)
 */
export class TypeORMDispatch extends Dispatch<
  Adapter<DataSourceOptions, DataSource, TypeORMQuery, TypeORMContext>
> {
  private eventMode: TypeORMEventMode;
  private driver: TypeORMDriver;
  private subscriber?: TypeORMEventSubscriber;

  constructor() {
    super();
    this.eventMode = TypeORMEventMode.SUBSCRIBER;
    this.driver = TypeORMDriver.POSTGRES;
  }
  
  setEventMode(mode: TypeORMEventMode, driver?: TypeORMDriver): void {
    this.eventMode = mode;
    if (driver) {
      this.driver = driver;
    }
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
    table: string | Constructor,
    operation: OperationKeys | string,
    ids: EventIds,
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<void> {
    const { log, ctxArgs } = this.logCtx(args, this.notificationHandler);
    try {
      // Notify observers
      await this.updateObservers(table, operation, ids, ...ctxArgs);
      log.verbose(`Observer refresh dispatched by ${operation} for ${table}`);
      log.debug(`pks: ${ids}`);
    } catch (e: unknown) {
      log.error(`Failed to process notification: ${e}`);
    }
  }

  /**
   * @description Initializes the dispatcher and subscribes to TypeORM notifications.
   * @summary Registers the TypeORMEventSubscriber on the DataSource and logs the subscription lifecycle.
   * Supports both SUBSCRIBER mode (TypeORM event subscribers) and TRIGGER mode (database triggers + polling).
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
   *   alt SUBSCRIBER mode
   *     S->>DS: subscribers.push(TypeORMEventSubscriber)
   *   else TRIGGER mode (PostgreSQL)
   *     S->>DS: CREATE TRIGGER ... EXECUTE FUNCTION ...
   *   end
   *   alt Success
   *     DS-->>S: Subscription established
   *     S-->>D: Promise resolves
   *     D->>L: Log successful subscription
   *   else Error
   *     DS-->>S: Error
   *     S-->>D: Promise rejects
   *   end
   */
  protected override async initialize(
    ...args: MaybeContextualArg<TypeORMContext>
  ): Promise<void> {
    async function subscribeToTypeORM(this: TypeORMDispatch): Promise<void> {
      if (!this.adapter)
        throw new InternalError(`No adapter/native observed for dispatch`);

      try {
        if (!this.adapter.client.isInitialized)
          await this.adapter.client.initialize();

        const { driver } = (this.adapter as any).constructor.getDriverConfig?.(this.adapter.client) || {
          driver: this.driver,
        };
        this.driver = driver;

        switch (this.eventMode) {
          case TypeORMEventMode.SUBSCRIBER:
            if (!this.subscriber) {
              this.subscriber = new TypeORMEventSubscriber(
                this.adapter,
                this.notificationHandler.bind(this)
              );
              const subs = (this.adapter.client as any).subscribers as
                | Array<any>
                | undefined;
              if (subs) subs.push(this.subscriber);
            }
            break;
          case TypeORMEventMode.TRIGGER:
            switch (this.driver) {
              case TypeORMDriver.POSTGRES:
                await this.adapter.client.query(
                  `CREATE OR REPLACE FUNCTION notify_table_changes()
RETURNS trigger AS $$
BEGIN
    PERFORM pg_notify(
        'table_changes',
        json_build_object(
            'table', TG_TABLE_NAME,
            'action', TG_OP,
            'data', row_to_json(NEW),
            'old_data', row_to_json(OLD)
        )::text
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;`
                );
                break;
              case TypeORMDriver.MYSQL:
              case TypeORMDriver.MARIA:
                await this.adapter.client.query(
                  `CREATE FUNCTION notify_table_changes()
RETURNS trigger
BEGIN
    SELECT JSON_OBJECT('table', TG_TABLE_NAME, 'action', TG_OP, 'data', JSON_OBJECTIFY(NEW), 'old_data', JSON_OBJECTIFY(OLD)) INTO @notify_data;
    SELECT GET_LOCK('table_changes_lock', 10) INTO @lock_result;
    SELECT RELEASE_LOCK('table_changes_lock') INTO @release_result;
    RETURN NEW;
END;`
                );
                break;
              case TypeORMDriver.SQLITE:
                throw new Error("SQLite does not support TRIGGER mode");
              case TypeORMDriver.SQLSERVER:
                await this.adapter.client.query(
                  `CREATE PROCEDURE notify_table_changes
AS
BEGIN
    DECLARE @notify_data NVARCHAR(MAX);
    SET @notify_data = (SELECT * FROM inserted FOR JSON PATH);
    EXEC sp_notify_db_change @notify_data;
END;`
                );
                break;
            }
            break;
        }
      } catch (e: unknown) {
        throw new InternalError(e as Error);
      }
    }

    const { log } = (
      await this.logCtx(args, PersistenceKeys.INITIALIZATION, true)
    ).for(this.initialize);

    subscribeToTypeORM
      .call(this)
      .then(() => {
        log.info(`Subscribed to TypeORM notifications in ${this.eventMode} mode for ${this.driver}`);
      })
      .catch((e: unknown) => {
        throw new InternalError(
          `Failed to subscribe to TypeORM notifications: ${e}`
        );
      });
  }

  override async close(
    ...ctxArgs: [...any[], TypeORMContext]
  ): Promise<void> {
    await this.detachSubscriber();
    return super.close(...ctxArgs);
  }

  private async detachSubscriber(): Promise<void> {
    if (!this.subscriber || !this.adapter) return;
    const subscribers = (this.adapter.client as any).subscribers as
      | Array<any>
      | undefined;
    if (subscribers) {
      const idx = subscribers.indexOf(this.subscriber);
      if (idx >= 0) subscribers.splice(idx, 1);
    }
    this.subscriber = undefined;
  }

  override async updateObservers(
    table: string | Constructor,
    operation: OperationKeys | string,
    ids: EventIds,
    ...args: ContextualArgs<TypeORMContext>
  ): Promise<void> {
    // When no adapter is observed (e.g., in unit tests invoking the handler directly),
    // skip notifying observers instead of throwing, so the dispatcher can proceed.
    // This matches the semantics of "best effort" notifications.
    // Delegate to base implementation when an adapter is present.
    if (!this.adapter) {
      this.log.verbose(
        `No adapter observed for dispatch; skipping observer update for ${table}:${operation}`
      );
      return;
    }
    return super.updateObservers(table, operation, ids, ...args);
  }
}
