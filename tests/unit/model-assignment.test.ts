import { Model, model, ModelArg } from "@decaf-ts/decorator-validation";
import { Adapter, uses } from "@decaf-ts/core";
import { TypeORMFlavour } from "../../src";

describe("Model assignment", () => {
  @uses(TypeORMFlavour)
  @model()
  class TestAssignment extends Model {
    constructor(arg: ModelArg<TestAssignment>) {
      super(arg);
    }
  }

  it("assigns model to Adapter", () => {
    const assigned = Adapter.models(TypeORMFlavour);
    expect(assigned).toContain(TestAssignment);
  });
});
