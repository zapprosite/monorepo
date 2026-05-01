#!/usr/bin/env python3
"""
Convert script(1) typescript + timing files to asciicast v2 format,
then optionally encode to MP4 via ffmpeg using ANSI input device.

Usage:
    python3 typescript-to-video.py <timing_file> <typescript_file> [output.mp4]

If output.mp4 is omitted, only the asciicast is produced (.cast).
"""
import sys
import os
import json
import re
import base64
import tempfile
import subprocess
import argparse
from pathlib import Path

ANSI_ESC = "\x1b"
FRAME_RATE = 20


def parse_timing(timing_path: str) -> list[tuple[float, int]]:
    """Parse script timing file. Returns list of (delay_sec, byte_count)."""
    entries = []
    with open(timing_path) as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if len(parts) >= 2:
                try:
                    delay = float(parts[0])
                    nbytes = int(parts[1])
                    entries.append((delay, nbytes))
                except ValueError:
                    pass
    return entries


def typescript_to_asciicast(timing_path: str, typescript_path: str, output_path: str) -> tuple[int, int]:
    """
    Convert script typescript + timing to asciicast v2.
    Returns (width, height) of the terminal.
    """
    timing_entries = parse_timing(timing_path)

    with open(typescript_path, "rb") as f:
        raw_data = f.read()

    # Scan for terminal geometry in the dump
    # Look for \x1b[8;<rows>;<cols>t sequences (xterm resize)
    width, height = 80, 24
    pattern = re.compile(rb"\x1b\[8;(\d+);(\d+)t")
    for m in pattern.finditer(raw_data):
        h, w = int(m.group(1)), int(m.group(2))
        if 10 <= w <= 512 and 5 <= h <= 256:
            width, height = w, h
            break

    # Parse typescript byte-by-byte tracking ANSI state
    # We'll accumulate output and emit asciicast events
    events = []
    cursor = 0

    for delay, nbytes in timing_entries:
        if nbytes <= 0 or cursor + nbytes > len(raw_data):
            break

        chunk = raw_data[cursor:cursor + nbytes]
        cursor += nbytes

        # Strip ANSI cursor sequences but keep visible content
        # Replace with spaces for accurate width measurement
        text_chunk = _strip_ansi(chunk)
        if not text_chunk:
            # Still record delay even for empty output (maintains timing)
            if events and delay > 0:
                events[-1] = (events[-1][0], events[-1][1] + delay)
            continue

        if delay > 0 and events and isinstance(events[-1][1], float):
            # Merge into previous event
            events[-1] = (events[-1][0] + text_chunk, events[-1][1] + delay)
        else:
            events.append((text_chunk, delay))

    # Write asciicast v2
    header = {
        "version": 2,
        "width": width,
        "height": height,
        "timestamp": int(os.path.getmtime(timing_path)) if os.path.exists(timing_path) else None,
        "env": {"TERM": os.environ.get("TERM", "linux"), "SHELL": os.environ.get("SHELL", "/bin/bash")},
        "title": f"Recording {Path(typescript_path).name}",
    }

    with open(output_path, "w") as f:
        f.write(json.dumps(header) + "\n")
        for i, (text, duration) in enumerate(events):
            if isinstance(text, bytes):
                text = text.decode("utf-8", errors="replace")
            encoded = base64.b64encode(text.encode("utf-8", errors="replace")).decode()
            f.write(json.dumps([i * 0.01, "o", encoded]) + "\n")

    return width, height


def _strip_ansi(data: bytes) -> bytes:
    """Remove ANSI cursor movement sequences, keep visible content."""
    result = bytearray()
    i = 0
    while i < len(data):
        b = data[i]
        if b == 0x1b and i + 1 < len(data) and data[i + 1] == 0x5b:  # ESC [
            # Parse CSI sequence
            j = i + 2
            while j < len(data) and data[j] < 0x40:
                j += 1
            # data[j] is the final byte
            # Skip cursor movement: CUU= A, CUD= B, CUF= C, CUB= D, CUP= H, etc.
            # Skip EL/EC/EPR etc.
            if j < len(data):
                final = data[j]
                # Movement commands: A,B,C,D, H, f, J, K, S, T, m (color/style handled differently)
                # We skip movement but want to preserve text
                # For simplicity: skip the CSI sequence entirely, keeping everything after
                # as it represents visible changes
                # Actually, for typescript we want the WRITTEN characters
                # Skip movement/erasure CSI, keep everything else
                if final in (0x41, 0x42, 0x43, 0x44, 0x48, 0x66,  # movement
                             0x4a, 0x4b,                          # erase
                             0x53, 0x54):                         # scroll
                    i = j + 1
                    continue
                elif final == 0x6d:  # SGR (color/style) - keep it
                    i = j + 1
                    continue
                else:
                    # Keep content after CSI
                    result.extend(data[i + 2:j])
                    i = j + 1
                    continue
            else:
                result.append(b)
                i += 1
        else:
            result.append(b)
            i += 1
    return bytes(result)


def render_ansi_frame(text: str, width: int, height: int, font: str = "DejaVu Sans Mono", font_size: int = 14) -> bytes:
    """Render ANSI text to a PNG frame using libvje/vjeutil or fallback."""
    # Use Python with PIL if available
    try:
        from PIL import Image, ImageDraw, ImageFont
        img = Image.new("RGB", (width * 8, height * 16), "black")
        draw = ImageDraw.Draw(img)
        font_obj = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", font_size)
        draw.text((0, 0), text, font=font_obj, fill="green")
        buf = BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()
    except ImportError:
        return b""


def typescript_to_video_ffmpeg(timing_path: str, typescript_path: str, output_mp4: str) -> bool:
    """
    Convert typescript + timing to MP4 using ffmpeg's built-in ansi input device.
    Falls back gracefully if it fails.
    Returns True if conversion succeeded.
    """
    if not os.path.exists(timing_path):
        print(f"Timing file not found: {timing_path}")
        return False

    # Determine duration from timing file
    total_delay = sum(delay for delay, _ in parse_timing(timing_path))
    duration = max(total_delay, 1.0)

    # Get terminal dimensions
    width, height = 80, 24
    try:
        with open(typescript_path, "rb") as f:
            raw = f.read()
        pattern = re.compile(rb"\x1b\[8;(\d+);(\d+)t")
        for m in pattern.finditer(raw):
            h, w = int(m.group(1)), int(m.group(2))
            if 10 <= w <= 512 and 5 <= h <= 256:
                width, height = w, h
                break
    except Exception:
        pass

    width = min(width, 120)
    height = min(height, 40)

    # ffmpeg command: read ANSI from typescript file via ansi input device
    # Use a fixed font file for the terminal display
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
    if not os.path.exists(font_path):
        font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"

    tmp_dir = Path(output_mp4).parent or Path.cwd()
    tmp_cast = tmp_dir / f".tmp_{Path(timing_path).name}.cast"
    try:
        # First produce asciicast
        typescript_to_asciicast(timing_path, typescript_path, str(tmp_cast))

        # Now convert asciicast to video using ffmpeg with ANSI device
        # The ansi device reads the raw typescript and renders it
        cmd = [
            "ffmpeg", "-y",
            "-f", "ansi",
            "-i", typescript_path,
            "-framerate", str(FRAME_RATE),
            "-c:v", "libx264",
            "-preset", "fast",
            "-crf", "28",
            "-pix_fmt", "yuv420p",
            "-t", str(duration),
            "-vf", f"scale={width*8}:{height*16},setsar=1",
            output_mp4,
        ]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=int(duration) + 30)
        if result.returncode != 0:
            print(f"ffmpeg conversion failed: {result.stderr[-500:]}")
            # Try simpler approach without scale
            cmd_simple = [
                "ffmpeg", "-y",
                "-f", "ansi", "-i", typescript_path,
                "-framerate", "20",
                "-c:v", "libx264", "-preset", "ultrafast", "-crf", "35",
                "-pix_fmt", "yuv420p",
                output_mp4,
            ]
            result2 = subprocess.run(cmd_simple, capture_output=True, text=True, timeout=int(duration) + 30)
            if result2.returncode != 0:
                print(f"Simple ffmpeg also failed: {result2.stderr[-500:]}")
                return False
        return True
    except Exception as e:
        print(f"Video conversion error: {e}")
        return False
    finally:
        if tmp_cast.exists():
            tmp_cast.unlink()


def main():
    parser = argparse.ArgumentParser(description="Convert script typescript to video")
    parser.add_argument("timing", help="script timing file (timing file from script -t)")
    parser.add_argument("typescript", help="script typescript file (output from script -a)")
    parser.add_argument("output", nargs="?", help="Output MP4 path (optional)")
    args = parser.parse_args()

    timing_p = args.timing
    typescript_p = args.typescript

    if not os.path.exists(timing_p):
        print(f"ERROR: Timing file not found: {timing_p}")
        sys.exit(1)
    if not os.path.exists(typescript_p):
        print(f"ERROR: Typescript file not found: {typescript_p}")
        sys.exit(1)

    # Always produce asciicast
    cast_path = str(Path(typescript_p).with_suffix(".cast"))
    w, h = typescript_to_asciicast(timing_p, typescript_p, cast_path)
    print(f"Asciicast: {cast_path} ({w}x{h})")

    if args.output:
        print(f"Converting to MP4: {args.output}")
        ok = typescript_to_video_ffmpeg(timing_p, typescript_p, args.output)
        if ok:
            print(f"MP4: {args.output}")
        else:
            print("MP4 conversion failed — asciicast saved for replay with: pip install agg && agg %s output.gif" % cast_path)
            sys.exit(1)


if __name__ == "__main__":
    main()
