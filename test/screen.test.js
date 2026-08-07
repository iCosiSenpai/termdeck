import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { createScreen } from "../src/ui/screen.js";

const SYNC_BEGIN = "\u001b[?2026h";
const SYNC_END = "\u001b[?2026l";

function fakeOutput() {
  const output = new EventEmitter();
  output.columns = 100;
  output.rows = 30;
  output.written = [];
  output.write = (value) => {
    output.written.push(value);
    return true;
  };
  output.flush = () => {
    const value = output.written.join("");
    output.written.length = 0;
    return value;
  };
  return output;
}

test("the first paint clears the screen and draws only the filled rows", () => {
  const output = fakeOutput();
  const screen = createScreen({ output, redraw: () => {} });
  screen.open();
  assert.equal(output.listenerCount("resize"), 1);
  output.flush();

  assert.equal(screen.paint(["alpha", "", "gamma"]), 2);
  const frame = output.flush();
  assert.ok(frame.startsWith(`${SYNC_BEGIN}\u001b[2J`));
  assert.ok(frame.endsWith(SYNC_END));
  assert.match(frame, /alpha/);
  assert.match(frame, /gamma/);
});

test("an unchanged frame writes nothing at all", () => {
  const output = fakeOutput();
  const screen = createScreen({ output, redraw: () => {} });
  screen.open();
  const rows = ["alpha", "beta", "gamma"];
  screen.paint(rows);
  output.flush();

  assert.equal(screen.paint([...rows]), 0);
  assert.equal(output.written.length, 0);
});

test("only the rows that changed are rewritten", () => {
  const output = fakeOutput();
  const screen = createScreen({ output, redraw: () => {} });
  screen.open();
  screen.paint(["alpha", "beta", "gamma", "delta"]);
  output.flush();

  assert.equal(screen.paint(["alpha", "BETA", "gamma", "delta"]), 1);
  assert.equal(output.flush(), `${SYNC_BEGIN}\u001b[2;1H\u001b[2KBETA${SYNC_END}`);
});

test("a burst of resize events becomes one repaint of the whole frame", async () => {
  const output = fakeOutput();
  let redraws = 0;
  const screen = createScreen({ output, redraw: () => { redraws += 1; }, resizeDelay: 1 });
  screen.open();
  screen.paint(["alpha", "beta"]);

  output.emit("resize");
  output.emit("resize");
  output.emit("resize");
  assert.equal(redraws, 0, "resize must not repaint synchronously");

  await new Promise((resolve) => { setTimeout(resolve, 20); });
  assert.equal(redraws, 1);

  output.flush();
  assert.equal(screen.paint(["alpha", "beta"]), 2, "a resize must force a full repaint");
});

test("a frame of a different height forces a full repaint", () => {
  const output = fakeOutput();
  const screen = createScreen({ output, redraw: () => {} });
  screen.open();
  screen.paint(["alpha", "beta"]);
  output.flush();

  assert.equal(screen.paint(["alpha", "beta", "gamma"]), 3);
  assert.match(output.flush(), /\u001b\[2J/);
});

test("closing releases the resize listener and restores the terminal", () => {
  const output = fakeOutput();
  const screen = createScreen({ output, redraw: () => {} });
  screen.open();
  output.flush();

  screen.close();
  assert.equal(output.flush(), "\u001b[?25h\u001b[?1049l\u001b[0m");
  assert.equal(output.listenerCount("resize"), 0);
});
