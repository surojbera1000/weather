#!/usr/bin/env python3
"""Generate the Weather Now PWA icons (no external libraries needed).

Draws a simple sun + cloud on a blue gradient and writes PNG files using
only the Python standard library (zlib + struct + binascii).
"""
import math
import struct
import zlib
import binascii

# ---- colors (r, g, b) ----
TOP = (41, 128, 185)      # #2980b9
BOTTOM = (109, 213, 250)  # #6dd5fa
SUN = (255, 209, 74)      # warm yellow
CLOUD = (255, 255, 255)


def lerp(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def mix(base, over, cov):
    cov = max(0.0, min(1.0, cov))
    return tuple(int(round(base[i] * (1 - cov) + over[i] * cov)) for i in range(3))


def circle_cov(u, v, cx, cy, r, aa):
    d = math.hypot(u - cx, v - cy)
    return max(0.0, min(1.0, (r - d) / aa + 0.5))


def ellipse_cov(u, v, cx, cy, rx, ry, aa):
    e = math.hypot((u - cx) / rx, (u * 0 + v - cy) / ry)
    # convert normalized ellipse distance back to roughly pixel space
    scale = aa / min(rx, ry)
    return max(0.0, min(1.0, (1.0 - e) / scale + 0.5))


def render(size, pad=0.0):
    """Return raw RGBA bytes for an icon of the given size.

    pad shrinks the artwork toward the center (used for maskable icons).
    """
    aa = 1.5 / size
    # artwork anchor points in 0..1 space (before padding)
    def P(x, y):
        # apply padding around center (0.5, 0.5)
        return (0.5 + (x - 0.5) * (1 - pad), 0.5 + (y - 0.5) * (1 - pad))

    sun_c = P(0.66, 0.33)
    sun_r = 0.145 * (1 - pad)

    clouds = [
        (P(0.38, 0.60), 0.125 * (1 - pad)),
        (P(0.52, 0.55), 0.155 * (1 - pad)),
        (P(0.66, 0.61), 0.125 * (1 - pad)),
    ]
    base_c = P(0.52, 0.66)
    base_rx, base_ry = 0.22 * (1 - pad), 0.085 * (1 - pad)

    rows = bytearray()
    for py in range(size):
        rows.append(0)  # PNG filter type 0 for each scanline
        v = py / size
        for px in range(size):
            u = px / size
            color = lerp(TOP, BOTTOM, v)

            # sun (behind cloud)
            sc = circle_cov(u, v, sun_c[0], sun_c[1], sun_r, aa)
            if sc > 0:
                color = mix(color, SUN, sc)

            # cloud (union of circles + a flat base ellipse)
            cc = ellipse_cov(u, v, base_c[0], base_c[1], base_rx, base_ry, aa)
            for (cx, cy), r in clouds:
                cc = max(cc, circle_cov(u, v, cx, cy, r, aa))
            if cc > 0:
                color = mix(color, CLOUD, cc)

            rows += bytes((color[0], color[1], color[2], 255))
    return bytes(rows)


def write_png(path, size, pad=0.0):
    raw = render(size, pad)
    comp = zlib.compress(raw, 9)

    def chunk(tag, data):
        out = struct.pack(">I", len(data)) + tag + data
        crc = binascii.crc32(tag + data) & 0xFFFFFFFF
        return out + struct.pack(">I", crc)

    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)  # 8-bit RGBA
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    write_png("icon-192.png", 192)
    write_png("icon-512.png", 512)
    write_png("icon-maskable-512.png", 512, pad=0.18)
    write_png("favicon-64.png", 64)
