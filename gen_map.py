"""
Generate biopunk trading floor map variations via Gemini Imagen 3.
Saves to webapp/frontend/public/sprites/trading-floor/
"""
import requests, base64, sys, os, json
from pathlib import Path

API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    sys.exit("GEMINI_API_KEY not set — export it (or load backend/.env) before running.")
OUT_DIR  = Path(r"C:\Users\humes\Desktop\Projects\ellie\webapp\frontend\public\sprites\trading-floor")
URL      = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key={API_KEY}"

PROMPTS = {
    1: """Top-down 2D pixel art RPG game map of an empty futuristic biopunk hedge fund trading floor. No people. No characters. No text. No words. No labels. Purely environmental.

The floor is dark obsidian tile with faint amber circuit-trace grid lines glowing between tiles. The room is divided into zones:
- Left cluster: rows of cyberpunk research workstations, dark desks with triple monitors seen from directly above, screens glowing teal-blue with chart data
- Center: wide open trading floor, rows of dual-monitor trading desks, screens glowing amber-orange
- Right: executive command zone, large curved dark desk with 4 monitors arranged in arc, screens glowing pink-purple
- Back wall: tall server racks floor-to-ceiling with blinking amber and blue LEDs

Ceiling decorations hanging into frame from the top edge: thick organic biopunk vines with large luminescent green leaves cascading downward, vines intertwined with glowing amber electrical cable bundles drooping at varying lengths — appearing at 6 positions across the ceiling

Corner and wall props: large glowing green bio-specimen glass cylinders, holographic pedestal displays casting teal light halos on the floor, biopunk potted plants with teal-blue leaves, wall-mounted data screens

Walls: dark gunmetal steel plating with exposed conduit runs, vent grilles, junction boxes

Lighting pools on floor: cool cyan glow in research zone, warm amber in trading zone, soft purple in executive zone

Art style: 2D top-down pixel art, JRPG game map style, 16-bit color palette with vivid neon accents on dark background, clean tile grid visible, high detail props, no characters whatsoever""",

    2: """2D top-down pixel art game map. Futuristic biopunk hedge fund trading floor. Empty — no people, no characters, no text, no words anywhere.

Cross-shaped floor plan: central hub with four wing zones branching out. Dark charcoal floor tiles with glowing teal circuit lines running between them.

Central hub: circular open area, holographic trading terminal in center, floor glows soft purple, data streams visualized as flowing light lines on the floor

North wing: server farm — rows of floor-to-ceiling server racks, blue-white LED strips, dark industrial

East wing: executive suite — one massive command desk spanning the wing, 6 monitors in curved arrangement, deep red-purple accent lighting

South wing: open trading pit — 3 rows of paired trading desks facing center, amber glow from screens

West wing: research lab — scattered workstations, bio-glow tanks full of green luminescent liquid, scientific equipment clusters

Ceiling: at every corridor junction, thick biopunk vines droop from above — dark stems, large glowing green leaves, wrapped with amber and orange electrical cables in bundles. The vines and wires hang like curtains at the zone entrances.

Wall detail: dark steel with hexagonal panel texture, orange warning stripe trim at floor level, wall-mounted holographic displays showing market data (screens have abstract chart graphics, no readable text)

Atmosphere: neon biopunk, organic-technological fusion, moody dark ambiance with vivid color accent pools

Pixel art style: top-down orthographic, JRPG map aesthetic, clean sprite work, 16-bit palette""",

    3: """Pixel art top-down 2D map. Empty biopunk hedge fund office. No humans. No characters. No text. No words.

Rectangular floor plan. The space is dominated by:

Floor: dark near-black tiles with a subtle 32px grid, glowing amber circuit traces forming geometric patterns between tiles — the traces glow brightest near workstation areas

Ceiling (visible as hanging elements at top of frame): massive organic biopunk vines with thick dark stems and large teal-glowing leaves spill downward from ceiling conduits. Alongside them: thick bundles of amber glowing cables hang in loose loops. The vines and cables are concentrated near walls and zone dividers, 8 clusters total across the width of the space.

Furniture layout seen from directly above:
- 4 clusters of 3 paired trading desks, dark surface, dual monitors showing glowing chart screens (teal/amber)
- 1 large executive command desk with curved monitor bank (6 screens, purple-pink glow)
- Back wall: 6 tall server racks with grid of blinking LED ports visible from above
- Side walls: 4 large cylindrical bio-tanks with green luminescent liquid, visible glow pools on floor around them
- Scattered: holographic display stands with floating teal projections, small potted biopunk plants

Zone dividers: low dark partition walls with glowing amber strip lighting on top edge

Room edges: thick dark walls with hexagonal metal panel texture, corner columns with pulsing teal conduit pipes running floor-to-ceiling

Overall palette: black and dark gray base, neon teal for bio-elements, amber-orange for electrical/screens, deep purple atmospheric mid-room glow, bright green for bio-tanks

Style: pixel art, top-down 2D, RPG game map, crisp pixel edges, no anti-aliasing, environmental storytelling through props"""
}

def generate(version):
    print(f"Generating V{version}...")
    payload = {
        "contents": [{"parts": [{"text": PROMPTS[version]}]}],
        "generationConfig": {"responseModalities": ["IMAGE"]}
    }
    r = requests.post(URL, json=payload, timeout=180)
    if r.status_code != 200:
        print(f"V{version} ERROR {r.status_code}: {r.text[:600]}")
        return
    data = r.json()
    try:
        parts = data["candidates"][0]["content"]["parts"]
        img_b64 = next(p["inlineData"]["data"] for p in parts if "inlineData" in p)
    except (KeyError, IndexError, StopIteration) as e:
        print(f"V{version} parse error: {e}\nResponse: {json.dumps(data)[:600]}")
        return
    out = OUT_DIR / f"trading-floor-map-v{version}.png"
    out.write_bytes(base64.b64decode(img_b64))
    print(f"V{version} saved → {out}  ({out.stat().st_size:,} bytes)")

version = int(sys.argv[1])
generate(version)
