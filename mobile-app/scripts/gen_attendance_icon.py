"""One-off generator for the Attendance kiosk flavor's launcher icon - a
simple white "staff" person glyph on the brand navy (#1E3A5F), replacing
the shared school-logo icon for this flavor only. Not part of the app
build; run manually if the icon ever needs regenerating.
"""
from PIL import Image, ImageDraw

BASE = "android/app/src/attendance/res"
SIZE = 432
NAVY = (30, 58, 95, 255)   # AppColors.navy
WHITE = (255, 255, 255, 255)

def draw_glyph(d, size, color):
    cx = size // 2
    scale = size / SIZE
    hr = int(62 * scale)
    hy = int(150 * scale)
    d.ellipse((cx - hr, hy - hr, cx + hr, hy + hr), fill=color)
    bw = int(210 * scale)
    bx0, bx1 = cx - bw // 2, cx + bw // 2
    by0 = int(250 * scale)
    by1 = int(372 * scale)
    radius = int(70 * scale)
    d.rounded_rectangle((bx0, by0, bx1, by1), radius=radius, corners=(True, True, False, False), fill=color)

# Adaptive icon foreground layer (transparent, glyph only)
fg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
draw_glyph(ImageDraw.Draw(fg), SIZE, WHITE)
fg.save(f"{BASE}/drawable/ic_launcher_foreground.png")

# Legacy per-density icons (solid navy square + glyph) for pre-API26 launchers
for name, px in [("mdpi", 48), ("hdpi", 72), ("xhdpi", 96), ("xxhdpi", 144), ("xxxhdpi", 192)]:
    img = Image.new("RGBA", (px, px), NAVY)
    draw_glyph(ImageDraw.Draw(img), px, WHITE)
    img.save(f"{BASE}/mipmap-{name}/ic_launcher.png")

print("done")
