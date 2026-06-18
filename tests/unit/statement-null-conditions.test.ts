import { Condition } from "@decaf-ts/core";
import { Model, model, ModelArg } from "@decaf-ts/decorator-validation";
import { uses } from "@decaf-ts/decoration";
import { TypeORMFlavour } from "../../src";
import { TypeORMStatement } from "../../src/query/Statement";

@uses(TypeORMFlavour)
@model()
class NullConditionModel extends Model {
  processed?: boolean | null;
  entityId?: number;

  constructor(arg?: ModelArg<NullConditionModel>) {
    super(arg);
  }
}

type RecordedCall = {
  method: "where" | "andWhere" | "orWhere";
  sql: string;
  params?: Record<string, any>;
};

class FakeQueryBuilder {
  calls: RecordedCall[] = [];

  where(sql: string, params?: Record<string, any>) {
    this.calls.push({ method: "where", sql, params });
    return this;
  }

  andWhere(sql: string, params?: Record<string, any>) {
    this.calls.push({ method: "andWhere", sql, params });
    return this;
  }

  orWhere(sql: string, params?: Record<string, any>) {
    this.calls.push({ method: "orWhere", sql, params });
    return this;
  }
}

function newStatement(): any {
  // parseCondition never touches the adapter, so a fake stand-in avoids needing
  // a real TypeORM connection for this unit test.
  return new TypeORMStatement<NullConditionModel, any>({} as any);
}

describe("TypeORMStatement IS [NOT] NULL translation", () => {
  it("translates .eq(null) into IS NULL with no bound parameter", () => {
    const qb = new FakeQueryBuilder();
    const condition = Condition.attribute<NullConditionModel>("processed").eq(null);

    const result = newStatement().parseCondition(condition, "data_source", qb);

    expect(result.query).toBe(qb);
    expect(qb.calls).toEqual([
      { method: "where", sql: "data_source.processed IS NULL", params: undefined },
    ]);
  });

  it("translates .dif(null) into IS NOT NULL with no bound parameter", () => {
    const qb = new FakeQueryBuilder();
    const condition = Condition.attribute<NullConditionModel>("processed").dif(null);

    const result = newStatement().parseCondition(condition, "data_source", qb);

    expect(result.query).toBe(qb);
    expect(qb.calls).toEqual([
      { method: "where", sql: "data_source.processed IS NOT NULL", params: undefined },
    ]);
  });

  it("still produces a parameterized clause for non-null equality (regression guard)", () => {
    const qb = new FakeQueryBuilder();
    const condition = Condition.attribute<NullConditionModel>("processed").eq(true);

    newStatement().parseCondition(condition, "data_source", qb);

    expect(qb.calls).toEqual([
      {
        method: "where",
        sql: "data_source.processed = :processed0",
        params: { processed0: true },
      },
    ]);
  });

  it("combines an IS NULL leg with a normal equality leg under AND", () => {
    const qb = new FakeQueryBuilder();
    const condition = Condition.attribute<NullConditionModel>("processed")
      .eq(null)
      .and(Condition.attribute<NullConditionModel>("entityId").eq(5));

    newStatement().parseCondition(condition, "data_source", qb);

    expect(qb.calls).toEqual([
      { method: "where", sql: "data_source.processed IS NULL", params: undefined },
      {
        method: "andWhere",
        sql: "data_source.entityId = :entityId2",
        params: { entityId2: 5 },
      },
    ]);
  });
});
