import { crop, displayWidth } from "./ansi.js";

/**
 * Places styled segments at 1-based columns inside a row of `width` columns.
 *
 * Segments are cropped to the space they actually have and are never allowed to
 * overlap, so a long theme name or a wide message cannot push the rest of the
 * row off screen or wrap into the next line.
 */
export function composeRow(width, segments) {
  let cursor = 1;
  let row = "";
  for (const segment of [...segments].sort((left, right) => left.column - right.column)) {
    if (!segment.value) continue;
    const column = Math.max(cursor, segment.column);
    if (column > width) break;
    const value = crop(segment.value, width - column + 1);
    if (!value) continue;
    row += `${" ".repeat(column - cursor)}${value}`;
    cursor = column + displayWidth(value);
  }
  return row;
}

/**
 * Chooses which slice of a list to display so the selection is always visible.
 *
 * When the list does not fit, one row is reserved for a scroll indicator and the
 * selection is centred in the remaining space. The result depends only on the
 * inputs, so a frame can be rebuilt at any time without tracking scroll state.
 */
export function windowList(length, selected, available) {
  if (available <= 0) return { start: 0, end: 0, scrolls: false };
  if (length <= available) return { start: 0, end: length, scrolls: false };
  const visible = Math.max(1, available - 1);
  const centred = selected - Math.floor(visible / 2);
  const start = Math.max(0, Math.min(centred, length - visible));
  return { start, end: start + visible, scrolls: true };
}
