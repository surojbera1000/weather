#!/usr/bin/env python3
"""Generate Weather Now app icons in the iOS Weather style:
   Golden sun peeking behind a white cloud on a blue-to-cyan gradient.
   Pure Python, no external libraries needed.
"""
import math
import struct
import zlib
import binascii

# ---- Colors ----
# Background gradient: deep blue (top) to bright cyan (bottom)
BG_TOP = (20, 80, 200)
BG_BOT = (30, 200, 240)

# Sun: golden yellow
SUN_CENTER = (255, 200, 40)
SUN_EDGE = (240, 175, 20)

# Cloud: white with a very light blue-tint shadow
CLOUD_WHITE = (255, 255, 255)
CLOUD_TINT = (220, 235, 250)


def lerp_c(a, b, t):
    return tuple(int(round(a[i] + (b[i] - a[i]) * t)) for i in range(3))


def mix(base, over, cov):
    cov = max(0.0, min(1.0, cov))
    return tuple(int(round(base[i] * (1 - cov) + over[i] * cov)) for i in range(3))


def circle_cov(u, v, cx, cy, r, aa=0.005):
    d = math.hypot(u - cx, v - cy)
    return max(0.0, min(1.0, (r - d) / aa + 0.5))


def ellipse_cov(u, v, cx, cy, rx, ry, aa=0.005):
    e = math.hypot((u - cx) / rx, (v - cy) / ry)
    scale = aa / min(rx, ry)
    return max(0.0, min(1.0, (1.0 - e) / scale + 0.5))


def render(size, pad=0.0):
    """Render the icon at a given size. pad shrinks artwork for maskable."""
    aa = 1.5 / size

    def P(x, y):
        return (0.5 + (x - 0.5) * (1 - pad), 0.5 + (y - 0.5) * (1 - pad))

    # Sun: top-left area, partially behind the cloud
    sun_c = P(0.35, 0.34)
    sun_r = 0.20 * (1 - pad)

    # Cloud: multiple circles forming a puffy shape, center-right
    cloud_circles = [
        (P(0.42, 0.60), 0.11 * (1 - pad)),   # left bump
        (P(0.52, 0.50), 0.14 * (1 - pad)),   # top bump
        (P(0.64, 0.52), 0.125 * (1 - pad)),  # right-top bump
        (P(0.72, 0.58), 0.10 * (1 - pad)),   # far-right bump
    ]
    cloud_base_c = P(0.56, 0.63)
    cloud_base_rx = 0.24 * (1 - pad)
    cloud_base_ry = 0.09 * (1 - pad)

    rows = bytearray()
    for py in range(size):
        rows.append(0)  # PNG filter
        v = py / size
        for px in range(size):
            u = px / size

            # Background gradient
            color = lerp_c(BG_TOP, BG_BOT, v)

            # Sun (drawn before cloud so cloud covers part of it)
            sc = circle_cov(u, v, sun_c[0], sun_c[1], sun_r, aa)
            if sc > 0:
                # Radial gradient on the sun
                dist_norm = math.hypot(u - sun_c[0], v - sun_c[1]) / sun_r
                sun_color = lerp_c(SUN_CENTER, SUN_EDGE, min(dist_norm, 1.0))
                color = mix(color, sun_color, sc)

            # Cloud (union of circles + base ellipse)
            cc = ellipse_cov(u, v, cloud_base_c[0], cloud_base_c[1],
                             cloud_base_rx, cloud_base_ry, aa)
            for (cx, cy), r in cloud_circles:
                cc = max(cc, circle_cov(u, v, cx, cy, r, aa))

            if cc > 0:
                # Subtle vertical gradient on cloud (white top, slight tint bottom)
                t_cloud = max(0, min(1, (v - 0.4) / 0.35))
                cloud_color = lerp_c(CLOUD_WHITE, CLOUD_TINT, t_cloud)
                color = mix(color, cloud_color, cc)

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
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    png = sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", comp) + chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)
    print(f"wrote {path} ({size}x{size})")


if __name__ == "__main__":
    write_png("icon-192.png", 192)
    write_png("icon-512.png", 512)
    write_png("icon-maskable-512.png", 512, pad=0.15)
    write_png("favicon-64.png", 64)
