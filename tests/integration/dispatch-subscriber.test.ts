import { TypeORMEventSubscriber } from "../../src/TypeORMEventSubscriber";
import { OperationKeys } from "@decaf-ts/db-decorators";
import { table, pk, EventIds } from "@decaf-ts/core";
import { model, ModelArg } from "@decaf-ts/decorator-validation";
import { TypeORMFlavour } from "../../src/constants";
import { TypeORMBaseModel } from "./baseModel";
import { TypeORMDispatch } from "../../src/TypeORMDispatch";
import { Constructor, Metadata, uses } from "@decaf-ts/decoration";
import { ContextualArgs } from "@decaf-ts/core";
import { Context } from "@decaf-ts/db-decorators";
import { Logging } from "@decaf-ts/logging";

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
      {
        logCtx: () => new Context(),
        context: () => new Context(),
      } as any,
      handler
    );

    const created = new SubscriberModel({ id: 1 });
    await sub.afterInsert({ entity: created, entityId: 1 } as any);

    expect(calls.length).toBe(1);
    expect(calls[0].tableName).toBe(Metadata.constr(SubscriberModel));
    expect(calls[0].op).toBe(OperationKeys.CREATE);
    expect(calls[0].ids).toEqual(1);
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
      {
        logCtx: () => new Context(),
        context: () => new Context(),
      } as any,
      handler
    );

    const removed = new SubscriberModel({ id: 7 });
    await sub.afterRemove({ metadata: { target: removed } } as any);

    expect(calls.length).toBe(1);
    expect(calls[0].op).toBe(OperationKeys.DELETE);
    expect(calls[0].ids).toEqual("");
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
      {
        logCtx: () => new Context(),
        context: () => new Context(),
      } as any,
      handler
    );

    const before = new SubscriberModel({ id: 9 });
    await sub.afterUpdate({ databaseEntity: before, entity: { id: 9 } } as any);

    expect(calls.length).toBe(1);
    expect(calls[0].tableName).toBe(Metadata.constr(SubscriberModel));
    expect(calls[0].op).toBe(OperationKeys.UPDATE);
    expect(calls[0].ids).toEqual(9);
  });
});

describe("TypeORMDispatch.notificationHandler", () => {
  it("logs error when updateObservers throws", async () => {
    const dispatch = new TypeORMDispatch();
    // Force an error inside notificationHandler
    const original = (dispatch as any).updateObservers.bind(dispatch);
    (dispatch as any).updateObservers = async () => {
      throw new Error("boom");
    };
    await (dispatch as any).notificationHandler(
      SubscriberModel,
      OperationKeys.DELETE,
      [2],
      new Context().accumulate({ logger: Logging.get() })
    );
    // restore to avoid side effects
    (dispatch as any).updateObservers = original;
  });
});
