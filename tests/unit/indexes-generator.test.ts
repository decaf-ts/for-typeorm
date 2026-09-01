import { generateIndexes } from "../../src/indexes/generator";
import { Model } from "@decaf-ts/decorator-validation";

// Mock Model static methods
jest.spyOn(Model, "indexes").mockImplementation(() => {
  return {
    'my"index': {
      col: { compositions: [] } as any,
    },
  } as any;
});
jest.spyOn(Model, "tableName").mockReturnValue('my"table');
jest.spyOn(Model, "defaultQueryAttributes").mockImplementation(() => {
  throw new Error("no default");
});

describe("generateIndexes produces quoted DDL", () => {
  it("quotes identifiers and produces empty values", () => {
    const results = generateIndexes([class Dummy {} as any]);
    const ddl = results.find((r) => r.query.includes("CREATE INDEX"))?.query;
    const indexName = 'my"index_index';
    const expected = `CREATE INDEX "${indexName.replace(/"/g, '""')}" ON "${'my"table'.replace(/"/g, '""')}" ("${'my"index'.replace(/"/g, '""')}");`;
    expect(ddl).toBe(expected);
    const entry = results.find((r) => r.query.includes("CREATE INDEX"));
    expect(entry?.values).toEqual([]);
  });

  it("inlines every emitted statement, keeps the table marker entry, and never emits bind parameters", () => {
    const results = generateIndexes([class Dummy {} as any]);
    for (const entry of results) {
      expect(entry.values).toEqual([]);
      expect(entry.query).not.toMatch(/\$\d/);
    }
    // the un-namespaced table marker entry stays untouched (empty query, empty values)
    expect(results.some((r) => r.query === "")).toBe(true);
    expect(
      results.filter((r) => r.query.startsWith("CREATE INDEX"))
    ).toHaveLength(1);
  });
});
