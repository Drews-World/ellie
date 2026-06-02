"""
Preview map compositor — downloads sprites from Pixellab CDN,
composes them into a 1024x640 top-down trading floor layout,
saves to public/sprites/trading-floor/trading-floor-preview.png
"""
from PIL import Image, ImageDraw
import requests, io
from pathlib import Path

CDN      = "https://backblaze.pixellab.ai/file/pixellab-characters/objects/c44d0e95-f47c-4c39-96ed-91692c3f5537"
LOCAL    = Path(r"C:\Users\humes\Desktop\Projects\ellie\webapp\frontend\public\sprites\trading-floor")
OUT      = LOCAL / "trading-floor-preview.png"

W, H = 1024, 680

# ── fetch helpers ──────────────────────────────────────────────────────────────

def cdn(obj_id, scale=None):
    url = f"{CDN}/{obj_id}/rotations/unknown.png"
    img = Image.open(io.BytesIO(requests.get(url, timeout=30).content)).convert("RGBA")
    if scale:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.NEAREST)
    return img

def local(name, scale=None):
    img = Image.open(LOCAL / name).convert("RGBA")
    if scale:
        img = img.resize((int(img.width * scale), int(img.height * scale)), Image.NEAREST)
    return img

def paste(canvas, sprite, x, y, flip=False):
    if flip:
        sprite = sprite.transpose(Image.FLIP_LEFT_RIGHT)
    bx = max(0, x)
    by = max(0, y)
    sx = bx - x
    sy = by - y
    sw = min(sprite.width - sx, W - bx)
    sh = min(sprite.height - sy, H - by)
    if sw <= 0 or sh <= 0:
        return
    region = sprite.crop((sx, sy, sx + sw, sy + sh))
    mask   = region.split()[3]
    canvas.paste(region, (bx, by), mask)

# ── sprites ───────────────────────────────────────────────────────────────────

print("Fetching sprites from Pixellab CDN...")

floor_tile   = local("floor-tiles.png")               # 128x128 dark obsidian
vine_tall    = cdn("5978a03c-86fb-4b71-9e76-99a8d332969b", scale=1.6)  # 80x256 vine → 128x410
wire_tall    = cdn("c35ae439-a901-4b3c-b313-d6d3234a686e", scale=1.6)  # 48x200 wire → 77x320
vine_cluster = cdn("25941925-3026-4f77-829b-adba2645f9b8", scale=1.5)  # 64x64 tangled vine
vine_wire    = cdn("c4ad82b5-996b-41a3-8dcb-9313feea87d0", scale=1.4)  # vine+wire combo
desk_biopunk = cdn("862fdd67-17b4-4545-9338-917122419edc", scale=1.8)  # 128x96 biopunk desk
desk_topdown = cdn("ab10cdc6-c57d-43de-98ba-02ee916d7129", scale=1.8)  # 96x64 top-down desk
exec_desk    = cdn("617a682f-6f2a-44d1-9f5f-c76c8d446972", scale=1.8)  # 160x96 exec cmd
research     = cdn("d2e82578-78d3-4a69-975d-826691817d2c", scale=1.6)  # isometric research
monitoring   = cdn("4b095fc3-8cf5-445c-a328-fec3dcd5f45c", scale=1.6)  # isometric monitoring
bio_tank     = cdn("9aed27ae-fe8d-4df8-b2d2-9b2bd1cab03b", scale=1.8)  # bio-glow tank
server_rack  = cdn("1aa71fef-add4-45e6-989d-75fc04e14043", scale=1.8)  # server rack
holo_display = cdn("c392cb32-3df8-4deb-b512-6c6963e643aa", scale=1.6)  # holographic readout
plant        = cdn("fcb570ff-216c-4858-9098-07c826b3711c", scale=1.6)  # teal biopunk plant
jumbotron    = cdn("7efcaf7e-a04c-43e1-8900-e26b02946d1d", scale=2.0)  # ticker display

print("Compositing...")

# ── canvas: tile the floor ─────────────────────────────────────────────────────

canvas = Image.new("RGBA", (W, H), (4, 5, 16, 255))
tw, th = floor_tile.size
for fy in range(0, H, th):
    for fx in range(0, W, tw):
        canvas.paste(floor_tile, (fx, fy), floor_tile)

# ── ceiling strip (top 90px) ───────────────────────────────────────────────────

ceiling = Image.new("RGBA", (W, 90), (2, 3, 12, 245))
canvas.paste(ceiling, (0, 0))

# ── ambient zone lighting ──────────────────────────────────────────────────────

glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gd = ImageDraw.Draw(glow)
# Left zone — cyan research
gd.ellipse([-60, 120,  340, 600], fill=(0, 180, 255, 18))
# Centre — amber trading
gd.ellipse([ 280, 80,  740, 650], fill=(255, 150, 30, 14))
# Right — purple exec
gd.ellipse([ 680, 120, 1080, 600], fill=(130, 50, 255, 18))
# Bottom — warm accent
gd.ellipse([ 200, 480, 820, 760], fill=(255, 120, 60, 10))
canvas = Image.alpha_composite(canvas, glow)

# ── zone divider lines on floor ────────────────────────────────────────────────

draw = ImageDraw.Draw(canvas)  # recreate after alpha_composite
# vertical dividers (dim amber)
draw.line([(340, 90), (340, H)], fill=(200, 130, 40, 60), width=2)
draw.line([(680, 90), (680, H)], fill=(200, 130, 40, 60), width=2)
# floor gutter at bottom wall
draw.rectangle([0, H - 50, W, H], fill=(2, 3, 10, 200))

# ── back wall servers ─────────────────────────────────────────────────────────

# Server racks along top wall (just below ceiling strip)
server_positions = [20, 100, 180, W-180-server_rack.width, W-100-server_rack.width, W-20-server_rack.width]
for sx in server_positions:
    paste(canvas, server_rack, sx, 90)

# ── jumbotron ticker (centre top) ─────────────────────────────────────────────

paste(canvas, jumbotron, W//2 - jumbotron.width//2, 100)

# ── LEFT zone: research workstations ──────────────────────────────────────────

# 2 columns × 3 rows of research stations
for row in range(3):
    for col in range(2):
        x = 20  + col * (research.width + 14)
        y = 220 + row * (research.height + 30)
        paste(canvas, research, x, y)

# holo display accent
paste(canvas, holo_display, 140, 510)
paste(canvas, plant,        30,  520)

# ── CENTRE zone: biopunk trading desks ────────────────────────────────────────

# 2 columns × 3 rows of biopunk desks
for row in range(3):
    for col in range(2):
        x = 360 + col * (desk_biopunk.width + 10)
        y = 180 + row * (desk_biopunk.height + 36)
        paste(canvas, desk_biopunk, x, y)

# monitoring station between cols
paste(canvas, monitoring, 500, 530)

# ── RIGHT zone: exec command + monitoring ─────────────────────────────────────

# Exec command desk — prominent centre-right
paste(canvas, exec_desk, 700, 220)

# monitoring rows below
for row in range(2):
    for col in range(2):
        x = 700 + col * (monitoring.width + 10)
        y = 390 + row * (monitoring.height + 30)
        paste(canvas, monitoring, x, y)

# holo display + plant accents
paste(canvas, holo_display, 970, 230)
paste(canvas, plant,        960, 400)

# ── bottom wall: bio tanks ────────────────────────────────────────────────────

bio_xs = [30, 200, 390, 590, 780, 960]
for bx in bio_xs:
    paste(canvas, bio_tank, bx - bio_tank.width//2, H - bio_tank.height - 50)

# ── CEILING: vines + wires hanging down ───────────────────────────────────────

# Alternating vines and wires across ceiling edge
ceiling_items = [
    (60,   vine_tall,    False),
    (170,  wire_tall,    False),
    (290,  vine_wire,    False),
    (410,  vine_tall,    True),   # flipped
    (510,  wire_tall,    False),
    (610,  vine_cluster, False),
    (720,  vine_tall,    False),
    (830,  wire_tall,    True),
    (940,  vine_wire,    True),
]
for cx, sprite, flip in ceiling_items:
    paste(canvas, sprite, cx - sprite.width//2, 0, flip=flip)

# Re-draw solid ceiling strip on top so vine roots look anchored
ceiling_top = Image.new("RGBA", (W, 28), (2, 3, 12, 255))
canvas.paste(ceiling_top, (0, 0))

# ── save ──────────────────────────────────────────────────────────────────────

canvas = canvas.convert("RGB")
canvas.save(OUT, "PNG", optimize=True)
print(f"Preview saved → {OUT}  ({OUT.stat().st_size:,} bytes)")
