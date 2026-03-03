import { TypeORMAdapter, TypeORMDriver, detectTypeORMDriver } from "../../src";
import { ValidationKeys } from "@decaf-ts/decorator-validation";

describe("TypeORMDriver Detection - SQLite", () => {
  describe("detectTypeORMDriver", () => {
    it("should detect SQLite driver from type: 'sqlite'", () => {
      const config = { type: "sqlite" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLITE);
    });

    it("should detect SQLite driver from type: 'better-sqlite3'", () => {
      const config = { type: "better-sqlite3" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLITE);
    });

    it("should detect SQLite driver from type: 'sqlite' (uppercase)", () => {
      const config = { type: "SQLITE" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLITE);
    });

    it("should detect SQLite driver with additional config options", () => {
      const config = {
        type: "sqlite",
        database: "test.db",
      };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLITE);
    });
  });

  describe("Driver-specific type parsing", () => {
    it("should parse SQLite string type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", false, false, TypeORMDriver.SQLITE);
      expect(typeResult).toBe("TEXT");
    });

    it("should parse SQLite string primary key type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", true, false, TypeORMDriver.SQLITE);
      expect(typeResult).toBe("TEXT PRIMARY KEY");
    });

    it("should parse SQLite number type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", false, false, TypeORMDriver.SQLITE);
      expect(typeResult).toBe("INTEGER");
    });

    it("should parse SQLite number primary key type with auto increment", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", true, false, TypeORMDriver.SQLITE);
      expect(typeResult).toBe("INTEGER PRIMARY KEY AUTOINCREMENT");
    });

    it("should parse SQLite boolean type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("boolean", false, false, TypeORMDriver.SQLITE);
      expect(typeResult).toBe("INTEGER");
    });

    it("should parse SQLite date type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("date", false, false, TypeORMDriver.SQLITE);
      expect(typeResult).toBe("DATETIME");
    });
  });

  describe("Driver-specific validation parsing", () => {
    it("should parse SQLite required validation", () => {
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.REQUIRED, {}, TypeORMDriver.SQLITE);
      expect(validationResult).toBe("NOT NULL");
    });

    it("should parse SQLite max_length validation with string type", () => {
      const options: any = {};
      options[ValidationKeys.MAX_LENGTH] = 255;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MAX_LENGTH, options, TypeORMDriver.SQLITE);
      expect(validationResult).toBe("(255)");
    });

    it("should parse SQLite min_length validation", () => {
      const options: any = {};
      options[ValidationKeys.MIN_LENGTH] = 3;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MIN_LENGTH, options, TypeORMDriver.SQLITE);
      expect(validationResult).toBe("CONSTRAINT name_min_length_check CHECK (LENGTH(name) >= 3)");
    });

    it("should parse SQLite pattern validation with LIKE", () => {
      const options: any = {};
      options[ValidationKeys.PATTERN] = /^[a-z]+$/;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.PATTERN, options, TypeORMDriver.SQLITE);
      expect(validationResult).toContain("CONSTRAINT name_pattern_check");
      expect(validationResult).toContain("LIKE '");
    });
  });
});
