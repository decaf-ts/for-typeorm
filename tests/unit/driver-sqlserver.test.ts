import { TypeORMAdapter, TypeORMDriver, detectTypeORMDriver } from "../../src";
import { ValidationKeys } from "@decaf-ts/decorator-validation";

describe("TypeORMDriver Detection - SQL Server", () => {
  describe("detectTypeORMDriver", () => {
    it("should detect SQL Server driver from type: 'mssql'", () => {
      const config = { type: "mssql" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLSERVER);
    });

    it("should detect SQL Server driver from type: 'mssql'", () => {
      const config = { type: "mssql" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLSERVER);
    });

    it("should detect SQL Server driver with additional config options", () => {
      const config = {
        type: "mssql",
        host: "localhost",
        port: 1433,
        user: "test",
        password: "test",
        database: "test",
      };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.SQLSERVER);
    });
  });

  describe("Driver-specific type parsing", () => {
    it("should parse SQL Server string type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", false, false, TypeORMDriver.SQLSERVER);
      expect(typeResult).toBe("NVARCHAR(255)");
    });

    it("should parse SQL Server string primary key type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", true, false, TypeORMDriver.SQLSERVER);
      expect(typeResult).toBe("NVARCHAR(255) PRIMARY KEY");
    });

    it("should parse SQL Server number type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", false, false, TypeORMDriver.SQLSERVER);
      expect(typeResult).toBe("INT");
    });

    it("should parse SQL Server number primary key type with identity", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", true, false, TypeORMDriver.SQLSERVER);
      expect(typeResult).toBe("INT PRIMARY KEY IDENTITY");
    });

    it("should parse SQL Server boolean type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("boolean", false, false, TypeORMDriver.SQLSERVER);
      expect(typeResult).toBe("BIT");
    });

    it("should parse SQL Server date type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("date", false, false, TypeORMDriver.SQLSERVER);
      expect(typeResult).toBe("DATETIME2");
    });
  });

  describe("Driver-specific validation parsing", () => {
    it("should parse SQL Server required validation", () => {
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.REQUIRED, {}, TypeORMDriver.SQLSERVER);
      expect(validationResult).toBe("NOT NULL");
    });

    it("should parse SQL Server max_length validation with string type", () => {
      const options: any = {};
      options[ValidationKeys.MAX_LENGTH] = 255;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MAX_LENGTH, options, TypeORMDriver.SQLSERVER);
      expect(validationResult).toBe("(255)");
    });

    it("should parse SQL Server min_length validation with LEN", () => {
      const options: any = {};
      options[ValidationKeys.MIN_LENGTH] = 3;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MIN_LENGTH, options, TypeORMDriver.SQLSERVER);
      expect(validationResult).toBe("CONSTRAINT name_min_length_check CHECK (LEN(name) >= 3)");
    });

    it("should parse SQL Server pattern validation with LIKE", () => {
      const options: any = {};
      options[ValidationKeys.PATTERN] = /^[a-z]+$/;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.PATTERN, options, TypeORMDriver.SQLSERVER);
      expect(validationResult).toContain("CONSTRAINT name_pattern_check");
      expect(validationResult).toContain("LIKE '");
    });
  });
});
