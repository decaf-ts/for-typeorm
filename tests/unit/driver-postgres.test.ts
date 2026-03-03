import { TypeORMAdapter, TypeORMDriver, detectTypeORMDriver } from "../../src";
import { ValidationKeys } from "@decaf-ts/decorator-validation";

describe("TypeORMDriver Detection - PostgreSQL", () => {
  describe("detectTypeORMDriver", () => {
    it("should detect PostgreSQL driver from type: 'postgres'", () => {
      const config = { type: "postgres" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.POSTGRES);
    });

    it("should detect PostgreSQL driver from type: 'pg'", () => {
      const config = { type: "pg" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.POSTGRES);
    });

    it("should detect PostgreSQL driver from type: 'POSTGRES' (uppercase)", () => {
      const config = { type: "POSTGRES" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.POSTGRES);
    });

    it("should detect PostgreSQL driver with additional config options", () => {
      const config = {
        type: "postgres",
        host: "localhost",
        port: 5432,
        username: "test",
        password: "test",
        database: "test",
      };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.POSTGRES);
    });

    it("should throw error when type is missing", () => {
      const config = {};
      expect(() => detectTypeORMDriver(config)).toThrow("Invalid TypeORM configuration: missing type");
    });

    it("should throw error for unsupported driver type", () => {
      const config = { type: "unknown" };
      expect(() => detectTypeORMDriver(config)).toThrow("Unsupported TypeORM driver: unknown");
    });
  });

  describe("Driver-specific type parsing", () => {
    it("should parse PostgreSQL string type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", false, false, TypeORMDriver.POSTGRES);
      expect(typeResult).toBe("VARCHAR");
    });

    it("should parse PostgreSQL string primary key type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", true, false, TypeORMDriver.POSTGRES);
      expect(typeResult).toBe("TEXT PRIMARY KEY");
    });

    it("should parse PostgreSQL number type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", false, false, TypeORMDriver.POSTGRES);
      expect(typeResult).toBe("INTEGER");
    });

    it("should parse PostgreSQL boolean type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("boolean", false, false, TypeORMDriver.POSTGRES);
      expect(typeResult).toBe("BOOLEAN");
    });

    it("should parse PostgreSQL date type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("date", false, false, TypeORMDriver.POSTGRES);
      expect(typeResult).toBe("TIMESTAMP");
    });
  });

  describe("Driver-specific validation parsing", () => {
    it("should parse PostgreSQL required validation", () => {
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.REQUIRED, {}, TypeORMDriver.POSTGRES);
      expect(validationResult).toBe("NOT NULL");
    });

    it("should parse PostgreSQL max_length validation with string type", () => {
      const options: any = {};
      options[ValidationKeys.MAX_LENGTH] = 255;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MAX_LENGTH, options, TypeORMDriver.POSTGRES);
      expect(validationResult).toBe("(255)");
    });

    it("should parse PostgreSQL min_length validation", () => {
      const options: any = {};
      options[ValidationKeys.MIN_LENGTH] = 3;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MIN_LENGTH, options, TypeORMDriver.POSTGRES);
      expect(validationResult).toBe("CONSTRAINT name_min_length_check CHECK (LENGTH(name) >= 3)");
    });

    it("should parse PostgreSQL pattern validation", () => {
      const options: any = {};
      options[ValidationKeys.PATTERN] = /^[a-z]+$/;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.PATTERN, options, TypeORMDriver.POSTGRES);
      expect(validationResult).toContain("CONSTRAINT name_pattern_check");
      expect(validationResult).toContain("~ '");
    });
  });
});
