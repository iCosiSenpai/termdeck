import { controls, ESC, move, RESET } from "./ansi.js";

/**
 * DEC mode 2026. The terminal buffers everything between the two sequences and
 * presents it as one atomic update, which removes tearing. Terminals that do not
 * implement the mode ignore it, so it is always safe to emit.
 */
const SYNC_BEGIN = `${ESC}?2026h`;
const SYNC_END = `${ESC}?2026l`;

/**
 * Owns the alternate screen and paints frames incrementally.
 *
 * A frame is an array of rows. Only the rows that differ from the previous frame
 * are rewritten, so moving the selection costs a couple of lines instead of a
 * full-screen clear and redraw.
 */
export function createScreen({ output, redraw, resizeDelay = 24 }) {
  let previous = null;
  let timer = null;

  function onResize() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      previous = null;
      redraw?.();
    }, resizeDelay);
    timer.unref?.();
  }

  return {
    open() {
      previous = null;
      output.write(`${controls.enterAltScreen}${controls.hideCursor}${controls.clearScreen}`);
      output.on("resize", onResize);
    },

    close() {
      if (timer) clearTimeout(timer);
      timer = null;
      previous = null;
      output.off("resize", onResize);
      output.write(`${controls.showCursor}${controls.leaveAltScreen}${RESET}`);
    },

    /** Discards the cached frame so the next paint redraws everything. */
    invalidate() {
      previous = null;
    },

    /** Paints the rows that changed. Returns how many rows were rewritten. */
    paint(rows) {
      let prefix = "";
      if (!previous || previous.length !== rows.length) {
        previous = new Array(rows.length).fill("");
        prefix = controls.clearScreen;
      }
      const patch = [];
      for (let index = 0; index < rows.length; index += 1) {
        if (rows[index] === previous[index]) continue;
        patch.push(`${move(index + 1, 1)}${controls.clearLine}${rows[index]}`);
        previous[index] = rows[index];
      }
      if (patch.length === 0 && !prefix) return 0;
      output.write(`${SYNC_BEGIN}${prefix}${patch.join("")}${SYNC_END}`);
      return patch.length;
    },
  };
}
