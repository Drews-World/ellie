"""
Quick image test — generates one image and saves it to disk.
Usage:
    python test_image.py                          # square, no bg removal
    python test_image.py mug                      # landscape, no bg removal
    python test_image.py tshirt                   # square + rembg
    python test_image.py poster                   # portrait, no bg removal
    python test_image.py tshirt "funny cat wizard drinking coffee"
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

PRODUCT_SIZES = {
    "tshirt": ("1024x1024", True),
    "hoodie": ("1024x1024", True),
    "mug":    ("1536x1024", False),
    "poster": ("1024x1536", False),
    "canvas": ("1024x1536", False),
    "sticker":("1024x1024", True),
    "tote":   ("1024x1024", True),
    "pillow": ("1024x1024", True),
}

product  = sys.argv[1] if len(sys.argv) > 1 else "square"
prompt   = sys.argv[2] if len(sys.argv) > 2 else "minimalist mountain sunrise mug design, bold clean lines, earthy tones"

size, do_rembg = PRODUCT_SIZES.get(product, ("1024x1024", False))

print(f"\nProduct : {product}")
print(f"Size    : {size}")
print(f"Rembg   : {do_rembg}")
print(f"Prompt  : {prompt}")
print("\nGenerating image...")

from core.image_gen import generate_image, remove_background

image_bytes = generate_image(prompt, size=size)
print(f"Generated {len(image_bytes):,} bytes")

if do_rembg:
    print("Removing background...")
    image_bytes = remove_background(image_bytes)
    print(f"After rembg: {len(image_bytes):,} bytes")

suffix = f"_{product}" if product != "square" else ""
suffix += "_nobg" if do_rembg else ""
out_path = Path(__file__).parent / f"test_output{suffix}.png"
out_path.write_bytes(image_bytes)
print(f"\nSaved → {out_path}")
