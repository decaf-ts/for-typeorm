import { TypeORMStatement } from "../../src/query/Statement";
import { AdapterFlags } from "@decaf-ts/core";
import { Model, model } from "@decaf-ts/decorator-validation";
import { uses } from "@decaf-ts/decoration";
import { TypeORMFlavour } from "../../src";

@uses(TypeORMFlavour)
@model()
class Dummy extends Model {}

describe("TypeORMStatement overrides passthrough", () => {
  it("stores overrides when provided", () => {
    const overrides: Partial<AdapterFlags> = { transactionLock: {} as any };
    const stmt = new TypeORMStatement<Dummy, any>({} as any, overrides);
    expect((stmt as any).overrides).toBe(overrides);
  });

  it("has undefined overrides when omitted", () => {
    const stmt = new TypeORMStatement<Dummy, any>({} as any);
    expect((stmt as any).overrides).toBeUndefined();
  });
});
