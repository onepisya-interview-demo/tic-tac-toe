import type { CSSProperties } from "react";
import { ImageResponse } from "next/og";

const ICON_COLORS = {
  background: "#0b0f17",
  board: "#e2e8f0",
  x: "#22d3ee",
  o: "#f472b6",
} as const;

const SCALE = 180 / 64;
const BOARD_LINE_WIDTH = 3 * SCALE;
const MARK_STROKE_WIDTH = 4 * SCALE;

// app/icon.svg viewBox is 0..64; we render at 180x180.
// Mark centers in SVG coordinates, mirroring app/icon.svg:
//   X drawn between top-left (cell 0) and top-mid (cell 1) so it spans the grid intersection
//   O drawn in the bottom-right cell (cell 8)
const X_CENTER_SVG = 22;
const X_CENTER_Y_SVG = 22;
const O_CENTER_SVG = 52;
const O_CENTER_Y_SVG = 50;
const O_RADIUS_SVG = 8;
// X bar length chosen so the rotated X reads visually similar to the SVG 16-unit arms
// once the 4-unit stroke is added on each end.
const X_LENGTH_SVG = 22.75;

const X_CENTER = X_CENTER_SVG * SCALE;
const X_CENTER_Y = X_CENTER_Y_SVG * SCALE;
const O_CENTER = O_CENTER_SVG * SCALE;
const O_CENTER_Y = O_CENTER_Y_SVG * SCALE;
const O_RADIUS = O_RADIUS_SVG * SCALE;
const X_LENGTH = X_LENGTH_SVG * SCALE;

const BOARD_LINES = [
  { left: 22 * SCALE, top: 10 * SCALE, width: BOARD_LINE_WIDTH, height: 44 * SCALE },
  { left: 42 * SCALE, top: 10 * SCALE, width: BOARD_LINE_WIDTH, height: 44 * SCALE },
  { left: 10 * SCALE, top: 22 * SCALE, width: 44 * SCALE, height: BOARD_LINE_WIDTH },
  { left: 10 * SCALE, top: 42 * SCALE, width: 44 * SCALE, height: BOARD_LINE_WIDTH },
] as const;

const X_ROTATIONS = ["rotate(45deg)", "rotate(-45deg)"] as const;
const BOARD_LINE_STYLE = {
  position: "absolute",
  backgroundColor: ICON_COLORS.board,
} as const;

export const size = { width: 180, height: 180 } as const;

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
          display: "flex",
          backgroundColor: ICON_COLORS.background,
          borderRadius: 12 * SCALE,
          overflow: "hidden",
        }}
      >
        {BOARD_LINES.map((style) => (
          <div
            key={`${style.left}-${style.top}`}
            style={{ ...BOARD_LINE_STYLE, ...style } satisfies CSSProperties}
          />
        ))}
        {X_ROTATIONS.map((transform) => (
          <div
            key={transform}
            style={{
              position: "absolute",
              left: X_CENTER - X_LENGTH / 2,
              top: X_CENTER_Y - MARK_STROKE_WIDTH / 2,
              width: X_LENGTH,
              height: MARK_STROKE_WIDTH,
              backgroundColor: ICON_COLORS.x,
              transform,
            }}
          />
        ))}
        <div
          style={{
            position: "absolute",
            left: O_CENTER - O_RADIUS,
            top: O_CENTER_Y - O_RADIUS,
            width: O_RADIUS * 2,
            height: O_RADIUS * 2,
            boxSizing: "border-box",
            border: `${MARK_STROKE_WIDTH}px solid ${ICON_COLORS.o}`,
            borderRadius: 999,
          }}
        />
      </div>
    ),
    size,
  );
}
