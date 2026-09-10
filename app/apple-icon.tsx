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
const MARK_WIDTH = 4 * SCALE;

const BOARD_LINES = [
  { left: 22 * SCALE, top: 10 * SCALE, width: BOARD_LINE_WIDTH, height: 44 * SCALE },
  { left: 42 * SCALE, top: 10 * SCALE, width: BOARD_LINE_WIDTH, height: 44 * SCALE },
  { left: 10 * SCALE, top: 22 * SCALE, width: 44 * SCALE, height: BOARD_LINE_WIDTH },
  { left: 10 * SCALE, top: 42 * SCALE, width: 44 * SCALE, height: BOARD_LINE_WIDTH },
] as const;

const X_LINES = ["rotate(45deg)", "rotate(-45deg)"] as const;
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
        {X_LINES.map((transform) => (
          <div key={transform} style={{ position: "absolute", left: 29.875, top: 56.25, width: 64, height: MARK_WIDTH, backgroundColor: ICON_COLORS.x, transform }} />
        ))}
        <div
          style={{
            position: "absolute",
            left: 123.75,
            top: 118.125,
            width: 45,
            height: 45,
            boxSizing: "border-box",
            border: `${MARK_WIDTH}px solid ${ICON_COLORS.o}`,
            borderRadius: 999,
          }}
        />
      </div>
    ),
    size,
  );
}
