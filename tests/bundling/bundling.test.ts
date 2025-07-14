import * as fs from "fs";
import { Dirent } from "fs";
import * as path from "path";
import pkg from "../../package.json";

describe("Distribution Tests", () => {
  it("reads lib", () => {
    const {
      VERSION,
      complexFunction,
      ChildClass,
    } = require("../../lib/index.cjs");
    expect(VERSION).toEqual(pkg.version);
    expect(complexFunction).toBeDefined();
    expect(ChildClass).toBeDefined();
  });

  it("reads JS Bundle", () => {
    let distFile: Dirent[];
    try {
      distFile = fs
        .readdirSync(path.join(__dirname, "../../dist"), {
          withFileTypes: true,
        })
        .filter((d) => d.isFile() && !d.name.endsWith("esm.js"));
    } catch (e: unknown) {
      throw new Error("Error reading JS bundle: " + e);
    }

    if (distFile.length === 0)
      throw new Error("There should only be a js file in directory");

    const { VERSION, complexFunction, ChildClass } = require(
      `../../dist/${distFile[0].name}`
    );
    expect(VERSION).toEqual(pkg.version);
    expect(complexFunction).toBeDefined();
    expect(ChildClass).toBeDefined();
  });
});
