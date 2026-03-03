import { TypeORMAdapter, TypeORMDriver, detectTypeORMDriver } from "../../src";
import { ValidationKeys } from "@decaf-ts/decorator-validation";

describe("TypeORMDriver Detection - MySQL", () => {
  describe("detectTypeORMDriver", () => {
    it("should detect MySQL driver from type: 'mysql'", () => {
      const config = { type: "mysql" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.MYSQL);
    });

    it("should detect MySQL driver from type: 'MYSQL' (uppercase)", () => {
      const config = { type: "MYSQL" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.MYSQL);
    });

    it("should detect MySQL driver with additional config options", () => {
      const config = {
        type: "mysql",
        host: "localhost",
        port: 3306,
        user: "test",
        password: "test",
        database: "test",
      };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.MYSQL);
    });

    it("should detect MariaDB driver from type: 'mariadb'", () => {
      const config = { type: "mariadb" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.MARIA);
    });

    it("should detect MariaDB driver from type: 'MARIA' (uppercase)", () => {
      const config = { type: "MARIA" };
      const driver = detectTypeORMDriver(config);
      expect(driver).toBe(TypeORMDriver.MARIA);
    });
  });

  describe("Driver-specific type parsing", () => {
    it("should parse MySQL string type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", false, false, TypeORMDriver.MYSQL);
      expect(typeResult).toBe("VARCHAR(255)");
    });

    it("should parse MySQL string primary key type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("string", true, false, TypeORMDriver.MYSQL);
      expect(typeResult).toBe("VARCHAR(255) PRIMARY KEY");
    });

    it("should parse MySQL number type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", false, false, TypeORMDriver.MYSQL);
      expect(typeResult).toBe("INT");
    });

    it("should parse MySQL number primary key type with auto increment", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("number", true, false, TypeORMDriver.MYSQL);
      expect(typeResult).toBe("INT PRIMARY KEY AUTO_INCREMENT");
    });

    it("should parse MySQL boolean type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("boolean", false, false, TypeORMDriver.MYSQL);
      expect(typeResult).toBe("TINYINT(1)");
    });

    it("should parse MySQL date type", () => {
      const typeResult = TypeORMAdapter["parseTypeToDriver"]("date", false, false, TypeORMDriver.MYSQL);
      expect(typeResult).toBe("DATETIME");
    });
  });

  describe("Driver-specific validation parsing", () => {
    it("should parse MySQL required validation", () => {
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.REQUIRED, {}, TypeORMDriver.MYSQL);
      expect(validationResult).toBe("NOT NULL");
    });

    it("should parse MySQL max_length validation with string type", () => {
      const options: any = {};
      options[ValidationKeys.MAX_LENGTH] = 255;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MAX_LENGTH, options, TypeORMDriver.MYSQL);
      expect(validationResult).toBe("(255)");
    });

    it("should parse MySQL min_length validation", () => {
      const options: any = {};
      options[ValidationKeys.MIN_LENGTH] = 3;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.MIN_LENGTH, options, TypeORMDriver.MYSQL);
      expect(validationResult).toBe("CONSTRAINT name_min_length_check CHECK (LENGTH(name) >= 3)");
    });

    it("should parse MySQL pattern validation with REGEXP", () => {
      const options: any = {};
      options[ValidationKeys.PATTERN] = /^[a-z]+$/;
      const validationResult = TypeORMAdapter["parseValidationToDriver"]("name", "string", false, ValidationKeys.PATTERN, options, TypeORMDriver.MYSQL);
      expect(validationResult).toContain("CONSTRAINT name_pattern_check");
      expect(validationResult).toContain("REGEXP '");
    });
  });
});
