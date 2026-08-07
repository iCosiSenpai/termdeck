import assert from "node:assert/strict";
import test from "node:test";
import { profiles } from "../src/profiles.js";

test("terminal profiles preserve the stock or user-configured font size", () => {
  for (const [name, profile] of Object.entries(profiles)) {
    assert.equal(profile.options["font-size"], undefined, `${name} must not override font-size`);
  }
});
