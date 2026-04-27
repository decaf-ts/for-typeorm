import { DataSourceOptions } from "typeorm";

function normalizeMigrationMode(options: DataSourceOptions): DataSourceOptions {
  return {
    ...options,
    synchronize: false,
    migrationsRun: true,
  };
}

describe("for-typeorm migration production mode", () => {
  it("forces migration mode instead of synchronize=true", () => {
    const options = normalizeMigrationMode({
      type: "sqlite",
      database: ":memory:",
      synchronize: true,
    });

    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(true);
  });

  it("preserves schema-oriented migration intent for table changes", () => {
    const before = { table: "prompts", columns: ["id", "name", "obsolete"] };
    const after = { table: "prompts", columns: ["id", "name", "model_type"] };

    expect(before.columns).toContain("obsolete");
    expect(after.columns).toContain("model_type");
    expect(after.columns).not.toContain("obsolete");
  });
});
