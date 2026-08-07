import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const agentPath = new URL("../.kiro/agents/termdeck-reviewer.json", import.meta.url);
const agent = JSON.parse(fs.readFileSync(agentPath, "utf8"));
const reviewScript = fs.readFileSync(new URL("../scripts/kiro-review.sh", import.meta.url), "utf8");
const gitignore = fs.readFileSync(new URL("../.gitignore", import.meta.url), "utf8");
const promptPath = new URL(agent.prompt.replace("file://./", ""), agentPath);
const reviewerPrompt = fs.readFileSync(promptPath, "utf8");

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
  assert.match(reviewerPrompt, /AGENTS\.md/);
  assert.match(reviewerPrompt, /REVIEW_INPUT_ERROR:/);
  assert.match(reviewerPrompt, /REVIEWED_DIFF:/);
  assert.match(reviewerPrompt, /one literal plain-text line in exactly this format/);
});

test("Kiro review hands off a temporary patch without persisting credentials", () => {
  assert.match(reviewScript, /kiro-cli whoami/);
  assert.match(reviewScript, /review_dir=.*\.build\/kiro-review/);
  assert.match(reviewScript, /mktemp "\$\{review_dir\}\/checkpoint\.XXXXXX"/);
  assert.doesNotMatch(reviewScript, /checkpoint\.XXXXXX\./);
  assert.match(reviewScript, /Read the exact Git diff from/);
  assert.doesNotMatch(reviewScript, /KIRO_API_KEY is required/);
  assert.match(gitignore, /^\.build\/$/m);
  assert.match(reviewScript, /trap 'cleanup; exit 130' 2/);
  assert.match(reviewScript, /exit "\$review_status"/);
  assert.match(reviewScript, /rmdir "\$review_dir"/);
  assert.match(reviewScript, /< \/dev\/null/);
  assert.match(reviewScript, /grep -Fq "REVIEW_INPUT_ERROR:"/);
  assert.match(reviewScript, /grep -Fq "REVIEWED_DIFF: \$\{review_file\}"/);
  assert.match(reviewScript, /review_status=3/);
  assert.match(reviewScript, /-name 'response\.\*'/);
});
