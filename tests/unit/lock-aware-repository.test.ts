import { TypeORMStatement } from "../../src/query/Statement";
import { Model, model } from "@decaf-ts/decorator-validation";
import { prop } from "@decaf-ts/decoration";
import { uses } from "@decaf-ts/decoration";
import { TypeORMFlavour } from "../../src";

@uses(TypeORMFlavour)
@model()
class Dummy extends Model {
  @prop({ primary: true })
  id!: number;
}

describe("TypeORMStatement lockAwareRepository", () => {
  const makeRepo = (name: string) => ({
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      query: `${name}_qb`,
    }),
  });

  const adapterRepo = makeRepo("adapter");
  const adapter = { client: { getRepository: () => adapterRepo } } as any;

  it("uses lock manager repository when transactionLock provided", () => {
    const lockRepo = makeRepo("lock");
    const lock = { manager: () => ({ getRepository: () => lockRepo }) } as any;
    jest.spyOn(Model, "pk").mockReturnValue("id");
    const stmt = new TypeORMStatement<Dummy, any>(adapter, { transactionLock: lock });
    // stub required properties
    (stmt as any).fromSelector = Dummy;
    Object.defineProperty(stmt, "log", { value: { for: () => ({ debug: () => {} }) } });
    const query = (stmt as any).build();
    expect(lockRepo.createQueryBuilder).toHaveBeenCalled();
    expect(query.query.query).toBe("lock_qb");
  });

  it("falls back to adapter client when no lock", () => {
    jest.spyOn(Model, "pk").mockReturnValue("id");
    const stmt = new TypeORMStatement<Dummy, any>(adapter);
    (stmt as any).fromSelector = Dummy;
    Object.defineProperty(stmt, "log", { value: { for: () => ({ debug: () => {} }) } });
    const query = (stmt as any).build();
    expect(adapterRepo.createQueryBuilder).toHaveBeenCalled();
    expect(query.query.query).toBe("adapter_qb");
  });

  it("falls back to adapter client when the lock manager returns undefined", () => {
    jest.spyOn(Model, "pk").mockReturnValue("id");
    const lock = { manager: () => undefined } as any;
    const stmt = new TypeORMStatement<Dummy, any>(adapter, { transactionLock: lock });
    (stmt as any).fromSelector = Dummy;
    Object.defineProperty(stmt, "log", { value: { for: () => ({ debug: () => {} }) } });
    const query = (stmt as any).build();
    expect(adapterRepo.createQueryBuilder).toHaveBeenCalled();
    expect(query.query.query).toBe("adapter_qb");
  });

  it("falls back to adapter client when the lock is missing its manager", () => {
    jest.spyOn(Model, "pk").mockReturnValue("id");
    const stmt = new TypeORMStatement<Dummy, any>(adapter, { transactionLock: {} as any });
    (stmt as any).fromSelector = Dummy;
    Object.defineProperty(stmt, "log", { value: { for: () => ({ debug: () => {} }) } });
    const query = (stmt as any).build();
    expect(adapterRepo.createQueryBuilder).toHaveBeenCalled();
    expect(query.query.query).toBe("adapter_qb");
  });
});
