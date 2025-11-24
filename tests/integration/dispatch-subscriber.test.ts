import { TypeORMEventSubscriber } from "../../src/TypeORMEventSubscriber";
import { OperationKeys } from "@decaf-ts/db-decorators";
import { table, pk, EventIds } from "@decaf-ts/core";
import { model, ModelArg, Model } from "@decaf-ts/decorator-validation";
import { TypeORMFlavour } from "../../src/constants";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMDispatch } from "../../src/TypeORMDispatch";
import { Constructor, uses } from "@decaf-ts/decoration";
import { ContextualArgs } from "@decaf-ts/core";
import { Context } from "@decaf-ts/db-decorators";

@uses(TypeORMFlavour)
@table("tst_subscriber")
@model()
class SubscriberModel extends TypeORMBaseModel {
  @pk({ type: "Number" })
  id!: number;

  constructor(arg?: ModelArg<SubscriberModel>) {
    super(arg);
  }
}

describe("TypeORMEventSubscriber", () => {
  it("invokes handler on afterInsert with correct payload", async () => {
    const calls: any[] = [];
    const handler = (
      tableName: string | Constructor,
      op: OperationKeys | string,
      ids: EventIds,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ...args: ContextualArgs<any>
    ) => {
      calls.push({ tableName, op, ids });
    };
    const sub = new TypeORMEventSubscriber(
      { logCtx: () => new Context() } as any,
      handler
    );

    const created = new SubscriberModel({ id: 1 });
    sub.afterInsert({ entity: created, entityId: 1 } as any);

    expect(calls.length).toBe(1);
    expect(calls[0].tableName).toBe(Model.tableName(SubscriberModel));
    expect(calls[0].op).toBe(OperationKeys.CREATE);
    expect(calls[0].ids).toEqual([1]);
  });

  it("invokes handler on afterRemove with correct payload", async () => {
    const calls: any[] = [];
    const handler = (
      tableName: string | Constructor,
      op: OperationKeys | string,
      ids: EventIds,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ...args: ContextualArgs<any>
    ) => {
      calls.push({ tableName, op, ids });
    };
    const sub = new TypeORMEventSubscriber(
      { logCtx: () => new Context() } as any,
      handler
    );

    const removed = new SubscriberModel({ id: 7 });
    sub.afterRemove({ entity: removed, entityId: 7 } as any);

    expect(calls.length).toBe(1);
    expect(calls[0].tableName).toBe(Model.tableName(SubscriberModel));
    expect(calls[0].op).toBe(OperationKeys.DELETE);
    expect(calls[0].ids).toEqual([7]);
  });

  it("invokes handler on afterUpdate with correct payload", async () => {
    const calls: any[] = [];
    const handler = (
      tableName: string | Constructor,
      op: OperationKeys | string,
      ids: EventIds,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      ...args: ContextualArgs<any>
    ) => {
      calls.push({ tableName, op, ids });
    };
    const sub = new TypeORMEventSubscriber(
      { logCtx: () => new Context() } as any,
      handler
    );

    const before = new SubscriberModel({ id: 9 });
    sub.afterUpdate({ databaseEntity: before, entity: { id: 9 } } as any);

    expect(calls.length).toBe(1);
    expect(calls[0].tableName).toBe(Model.tableName(SubscriberModel));
    expect(calls[0].op).toBe(OperationKeys.UPDATE);
    expect(calls[0].ids).toEqual([9]);
  });
});

describe("TypeORMDispatch.notificationHandler", () => {
  it("handles successful notifications without observers", async () => {
    const dispatch = new TypeORMDispatch();
    await (dispatch as any).notificationHandler(
      Model.tableName(SubscriberModel),
      OperationKeys.CREATE,
      [1],
      new Context()
    );
    // No error thrown and internal state updated
    expect((dispatch as any).observerLastUpdate).toBeDefined();
  });

  it("logs error when updateObservers throws", async () => {
    const dispatch = new TypeORMDispatch();
    // Force an error inside notificationHandler
    const original = (dispatch as any).updateObservers.bind(dispatch);
    (dispatch as any).updateObservers = async () => {
      throw new Error("boom");
    };
    await (dispatch as any).notificationHandler(
      Model.tableName(SubscriberModel),
      OperationKeys.DELETE,
      [2],
      new Context()
    );
    // restore to avoid side effects
    (dispatch as any).updateObservers = original;
  });
});
