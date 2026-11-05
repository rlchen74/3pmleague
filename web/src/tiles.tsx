// All 42 tiles, U+1F000 to U+1F029 (no joker)
export const TILES = Array.from({ length: 42 }, (_, i) =>
  String.fromCodePoint(0x1f000 + i),
)

// Draws a tile from /tiles/<hex>.svg. The height follows the surrounding
// text size, so classes like text-4xl still control how big it is.
export function Tile({ t, className = '' }: { t: string; className?: string }) {
  const hex = t.codePointAt(0)!.toString(16)
  return (
    <span className={`inline-flex items-center align-middle ${className}`}>
      <img
        src={`/tiles/${hex}.svg`}
        alt={t}
        draggable={false}
        style={{ height: '1.25em', width: 'auto' }}
      />
    </span>
  )
}