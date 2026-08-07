import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const agentPath = new URL("../.kiro/agents/termdeck-reviewer.json", import.meta.url);
const agent = JSON.parse(fs.readFileSync(agentPath, "utf8"));

test("Kiro checkpoint reviewer is constrained to read-only tools", () => {
  assert.deepEqual(agent.tools, ["read"]);
  assert.deepEqual(agent.allowedTools, ["read"]);
  assert.equal(agent.includeMcpJson, false);

  const denied = new Set(
    agent.permissions.rules
      .filter((rule) => rule.effect === "deny")
      .map((rule) => rule.capability),
  );
  assert.deepEqual(denied, new Set(["fs_write", "shell", "mcp", "subagent"]));
});

test("Kiro reviewer prompt exists beside its agent configuration", () => {
  assert.match(agent.prompt, /^file:\/\/\.\//);
  const promptPath = new URL(agent.prompt.replace("file://./", ""), agentPath);
  assert.match(fs.readFileSync(promptPath, "utf8"), /AGENTS\.md/);
});
