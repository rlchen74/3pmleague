// All 42 tiles, U+1F000 to U+1F029 (no joker)
export const TILES = Array.from({ length: 42 }, (_, i) =>
  String.fromCodePoint(0x1f000 + i),
)

const FONT = "'Noto Sans Symbols 2', system-ui, sans-serif"

// Draws a tile glyph. The red dragon gets U+FE0E so it shows as a tile, not an emoji.
export function Tile({ t }: { t: string }) {
  const redDragon = t.codePointAt(0) === 0x1f004
  return (
    <span style={{ fontFamily: FONT }}>
      {t}
      {redDragon ? '\uFE0E' : ''}
    </span>
  )
}