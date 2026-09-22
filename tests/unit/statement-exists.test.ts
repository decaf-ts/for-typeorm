import { Condition, Operator } from "@decaf-ts/core";
import { Model, model, ModelArg } from "@decaf-ts/decorator-validation";
import { uses } from "@decaf-ts/decoration";
import { IsNull, Not } from "typeorm";
import { TypeORMFlavour } from "../../src";
import { TypeORMStatement } from "../../src/query/Statement";
import { SQLOperator } from "../../src/types";

@uses(TypeORMFlavour)
@model()
class ExistsConditionModel extends Model {
  processed?: boolean;
  entityId?: number;

  constructor(arg?: ModelArg<ExistsConditionModel>) {
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
  return new TypeORMStatement<ExistsConditionModel, any>({} as any);
}

describe("TypeORMStatement EXISTS translation", () => {
  it("translates a field-level EXISTS condition into IS NOT NULL", () => {
    const qb = new FakeQueryBuilder();
    const condition = Condition.attribute<ExistsConditionModel>("processed")
      .exists();

    const result = newStatement().parseCondition(condition, "data_source", qb);

    expect(result.query).toBe(qb);
    expect(qb.calls).toEqual([
      {
        method: "where",
        sql: "data_source.processed IS NOT NULL",
        params: undefined,
      },
    ]);
  });

  it("uses the TypeORM IS NOT NULL operator constant", () => {
    expect(SQLOperator.IS_NOT_NULL).toBe("IS NOT NULL");
  });

  it("combines an EXISTS leg with a normal equality leg under AND", () => {
    const qb = new FakeQueryBuilder();
    const condition = Condition.attribute<ExistsConditionModel>("processed")
      .exists()
      .and(Condition.attribute<ExistsConditionModel>("entityId").eq(5));

    newStatement().parseCondition(condition, "data_source", qb);

    expect(qb.calls).toEqual([
      {
        method: "where",
        sql: "data_source.processed IS NOT NULL",
        params: undefined,
      },
      {
        method: "andWhere",
        sql: "data_source.entityId = :entityId2",
        params: { entityId2: 5 },
      },
    ]);
  });

  it("maps EXISTS onto Not(IsNull()) for the find path", () => {
    const statement = newStatement();

    const value = statement.buildFindValue(Operator.EXISTS, true);

    expect(value).toEqual(Not(IsNull()));
  });
});
