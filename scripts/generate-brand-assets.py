"""
Draws Bella's app icon and splash images from one vector mark (a serif B
hanging from a clothes-hanger hook) and writes the PNGs app.json points at.

Run from the repo root after changing the mark or colors:
    python3 -m pip install cairosvg pillow
    python3 scripts/generate-brand-assets.py

The B is the outline of the "B" glyph from DM Serif Display (SIL Open Font
License 1.1), converted to a path so no font is needed at render time.
"""

import io
import math
from pathlib import Path

import cairosvg
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / 'assets' / 'images'

# Matches src/constants/theme.ts
ROSEWOOD = '#9E4636'
ROSEWOOD_DARK = '#E3907B'
CREAM = '#FBF9F7'

# DM Serif Display "B": font units, y up, bounds (22, 0, 576, 660).
B_PATH = 'M22 0V10L40 17Q60 25 67.5 37.0Q75 49 75 69V591Q75 612 67.5 624.0Q60 636 40 643L22 650V660H309Q431 660 485.0 615.5Q539 571 539 503Q539 452 499.5 410.5Q460 369 364 352Q474 340 525.0 294.5Q576 249 576 184Q576 152 562.0 119.5Q548 87 514.5 60.0Q481 33 423.0 16.5Q365 0 276 0ZM223 353H266Q333 353 362.5 384.0Q392 415 392 492Q392 572 365.0 606.0Q338 640 277 640H223ZM223 20H273Q348 20 384.5 60.0Q421 100 421 185Q421 265 386.0 299.0Q351 333 271 333H223Z'
B_BOUNDS = (22, 0, 576, 660)

# The mark is laid out on a 1024 canvas, then moved and scaled per asset.
# It spans x 344..680 and y 254..790, so its centre is (512, 522).
MARK_CENTER = (512, 522)
MARK_HEIGHT = 536


def mark(color: str) -> str:
    x0, y0, x1, y1 = B_BOUNDS
    b_height = 400
    baseline = 790
    s = b_height / (y1 - y0)
    tx = 512 - (x1 - x0) * s / 2 - x0 * s
    b_top = baseline - y1 * s

    # Straight stem up from the top of the B into a hook that curls over and
    # down its left side.
    stroke, r, stem = 32, 44, 80
    x, top = 512, b_top + 4
    cx, cy = x - r, top - stem
    end = math.radians(200)
    ex, ey = cx + r * math.cos(end), cy - r * math.sin(end)
    return (
        f'<path d="{B_PATH}" fill="{color}" '
        f'transform="translate({tx:.2f},{baseline}) scale({s:.4f},{-s:.4f})"/>'
        # The stem has a flat end so it doesn't poke through the B's thin top stroke.
        f'<path d="M{x} {top:.1f} L{x} {cy - 1:.1f}" stroke="{color}" stroke-width="{stroke}"/>'
        f'<path d="M{x} {cy:.1f} A{r} {r} 0 1 0 {ex:.1f} {ey:.1f}" fill="none" '
        f'stroke="{color}" stroke-width="{stroke}" stroke-linecap="round"/>'
    )


def canvas(color: str, height: float, background: str | None = None) -> str:
    """The mark centred on a 1024 canvas, scaled to the given height in pixels."""
    s = height / MARK_HEIGHT
    tx = 512 - MARK_CENTER[0] * s
    ty = 512 - MARK_CENTER[1] * s
    bg = f'<rect width="1024" height="1024" fill="{background}"/>' if background else ''
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">'
        f'{bg}<g transform="translate({tx:.2f},{ty:.2f}) scale({s:.4f})">{mark(color)}</g></svg>'
    )


def save(name: str, svg: str, size: int = 1024) -> None:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    Image.open(io.BytesIO(png)).save(OUT / name, optimize=True)
    print(f'wrote assets/images/{name}')


def main() -> None:
    # iOS and the default icon: opaque, cream mark on rosewood.
    save('icon.png', canvas(CREAM, MARK_HEIGHT, ROSEWOOD))
    # iOS 18 dark icon keeps a transparent background; the system fills it.
    save('icon-dark.png', canvas(ROSEWOOD_DARK, MARK_HEIGHT))
    # iOS 18 tinted icon: a grayscale image the system tints.
    save('icon-tinted.png', canvas('#FFFFFF', MARK_HEIGHT, '#000000'))

    # Android adaptive icon (108dp canvas). Launchers show the middle 72dp
    # and may mask to a 66dp circle, so the mark stays well inside that.
    adaptive_height = 400
    save('android-icon-foreground.png', canvas(CREAM, adaptive_height))
    save('android-icon-background.png', f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="{ROSEWOOD}"/></svg>')
    save('android-icon-monochrome.png', canvas('#FFFFFF', adaptive_height))

    # Splash images: the mark alone, on the light and dark app backgrounds
    # set in app.json. Android 12+ crops the splash icon to a circle, which
    # imageWidth in app.json accounts for.
    splash_height = 940
    save('splash-icon.png', canvas(ROSEWOOD, splash_height))
    save('splash-icon-dark.png', canvas(ROSEWOOD_DARK, splash_height))

    save('favicon.png', canvas(CREAM, MARK_HEIGHT, ROSEWOOD), size=48)


if __name__ == '__main__':
    main()
