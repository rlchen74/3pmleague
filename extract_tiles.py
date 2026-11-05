import re
import sys
import pathlib
from fontTools.ttLib import TTFont

font_path = sys.argv[1] if len(sys.argv) > 1 else "GL-MahjongTile-Clr.woff"
out_dir = pathlib.Path(sys.argv[2] if len(sys.argv) > 2 else "tiles")
out_dir.mkdir(parents=True, exist_ok=True)

font = TTFont(font_path)
cmap = font.getBestCmap()
gid_of = {name: i for i, name in enumerate(font.getGlyphOrder())}
hhea, hmtx = font["hhea"], font["hmtx"]

docs = {}
for entry in font["SVG "].docList:
    for gid in range(entry[1], entry[2] + 1):
        docs[gid] = entry[0]

count = 0
for cp in range(0x1F000, 0x1F02A):  # the 42 tiles, no joker
    name = cmap.get(cp)
    if name is None:
        print(f"No glyph for U+{cp:X}")
        continue
    gid = gid_of[name]
    doc = docs.get(gid)
    if doc is None:
        print(f"No SVG drawing for U+{cp:X}")
        continue

    advance = hmtx[name][0]
    top = hhea.ascent
    height = hhea.ascent - hhea.descent

    m = re.search(r"<svg\b[^>]*>", doc)
    tag = re.sub(r'\s(viewBox|width|height)="[^"]*"', "", m.group(0))
    if "xmlns=" not in tag:
        tag = tag.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"', 1)
    if "xmlns:xlink" not in tag:
        tag = tag.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"', 1)
    tag = tag.replace(
        "<svg", f'<svg viewBox="0 {-top} {advance} {height}" width="{advance}" height="{height}"', 1
    )
    # Hide every glyph in this document except the one we want
    style = f'<style>[id^="glyph"]{{display:none}}#glyph{gid}{{display:inline}}</style>'
    svg = tag + style + doc[m.end():]

    (out_dir / f"{cp:x}.svg").write_text(svg, encoding="utf-8")
    count += 1

    if cp == 0x1F000:
        print("--- diagnostics for U+1F000 ---")
        print("glyph id:", gid, "| id found in drawing:", f'id="glyph{gid}"' in doc)
        print("ascent/descent/advance:", hhea.ascent, hhea.descent, advance)
        print("drawing starts with:", doc[:400].replace("\n", " "))
        print("-------------------------------")

print(f"Wrote {count} tiles to {out_dir}")