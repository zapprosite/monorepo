#!/usr/bin/env python3
"""
HVAC Formatter — Printable Output Formatter
Formats HVAC RAG responses for 58mm thermal printers.

Features:
- Strip all markdown formatting
- 58mm thermal printer width (~48 chars)
- ASCII safety boxes
- Numbered procedures
- Model/error code highlighting
- QR code generation for digital link (optional)
"""

import re
import unicodedata
from typing import Optional

# Thermal printer width for 58mm paper
PRINTER_WIDTH = 48
PRINTER_WIDTH_NARROW = 32


def nfc_normalize(text: str) -> str:
    """Normalize text to NFC form for consistent handling."""
    return unicodedata.normalize('NFC', text)


def strip_markdown(text: str) -> str:
    """Remove markdown formatting from text."""
    # Remove headers (# ## etc)
    text = re.sub(r'^#{1,6}\s+', '', text, flags=re.MULTILINE)
    # Remove bold/italic
    text = re.sub(r'\*{1,3}([^*]+)\*{1,3}', r'\1', text)
    text = re.sub(r'_{1,3}([^_]+)_{1,3}', r'\1', text)
    # Remove inline code
    text = re.sub(r'`([^`]+)`', r'\1', text)
    # Remove code blocks
    text = re.sub(r'```[\s\S]*?```', '', text)
    # Remove links but keep text
    text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', text)
    # Remove images
    text = re.sub(r'!\[([^\]]*)\]\([^)]+\)', r'\1', text)
    # Remove blockquotes
    text = re.sub(r'^>\s+', '', text, flags=re.MULTILINE)
    # Remove horizontal rules
    text = re.sub(r'^[-*_]{3,}\s*$', '', text, flags=re.MULTILINE)
    # Remove bullet points but keep text
    text = re.sub(r'^[\s]*[-*+]\s+', '', text, flags=re.MULTILINE)
    # Remove numbered lists
    text = re.sub(r'^[\s]*\d+\.\s+', '', text, flags=re.MULTILINE)
    # Clean up excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def wrap_text(text: str, width: int = PRINTER_WIDTH, indent: str = '') -> str:
    """Wrap text to specified width with optional indent."""
    words = text.split()
    lines = []
    current_line = indent
    current_width = len(indent)

    for word in words:
        word_len = len(word)
        if current_width + word_len + 1 <= width:
            if current_line == indent:
                current_line += word
                current_width += word_len
            else:
                current_line += ' ' + word
                current_width += word_len + 1
        else:
            if current_line != indent:
                lines.append(current_line)
            current_line = indent + word
            current_width = len(indent) + word_len

    if current_line != indent:
        lines.append(current_line)

    return '\n'.join(lines)


def highlight_models_errors(text: str) -> str:
    """Highlight model numbers and error codes with markers."""
    # Highlight model patterns (e.g., RXYQ20BR, RYYQ8, etc.)
    text = re.sub(
        r'\b([A-Z]{2,10}[0-9]{1,6}[A-Z0-9]*)\b',
        r'>\1<',
        text
    )
    # Highlight error codes (E1, A106, U4, etc.)
    text = re.sub(
        r'\b([A-Z]?\d{1,4})\b',
        r'*\1*',
        text
    )
    return text


def format_header(title: str, width: int = PRINTER_WIDTH) -> str:
    """Format a header line."""
    padding = width - len(title) - 2
    if padding > 0:
        side = '=' * (padding // 2)
        return f"{side} {title} {side}"
    return f"= {title} ="


def format_safety_box(text: str, width: int = PRINTER_WIDTH) -> str:
    """Format a safety warning box with ASCII art."""
    lines = text.strip().split('\n')
    border = '+' + '-' * (width - 2) + '+'
    inner_width = width - 4

    result = [border]

    for line in lines:
        line = line.strip()
        if not line:
            continue
        # Don't wrap safety headers - they are short and need the emoji
        if line.startswith('📋') or line.startswith('⚠'):
            result.append(f"|  {line:<{inner_width}}  |")
        elif len(line) <= inner_width:
            padding = inner_width - len(line)
            result.append(f"|  {line}{' ' * padding}  |")
        else:
            wrapped = wrap_text(line, inner_width, '  ')
            for wl in wrapped.split('\n'):
                result.append(f"|  {wl:<{inner_width}}  |")

    result.append(border)
    return '\n'.join(result)


def format_numbered_procedure(text: str, width: int = PRINTER_WIDTH) -> str:
    """Format numbered procedure steps."""
    lines = text.strip().split('\n')
    result = []
    step_num = 1

    for line in lines:
        line = line.strip()
        if not line:
            continue

        # Check if line starts with a number already
        if re.match(r'^\d+\.', line):
            result.append(wrap_text(line, width))
        elif line.startswith('-') or line.startswith('*'):
            # Convert bullet to numbered
            clean = re.sub(r'^[-*+]\s+', '', line)
            result.append(wrap_text(f"{step_num}. {clean}", width))
            step_num += 1
        elif 'PROCEDIMENTO' in line.upper() or 'PASSO' in line.upper():
            result.append(wrap_text(line, width))
        else:
            result.append(wrap_text(line, width))

    return '\n'.join(result)


def format_table(text: str, width: int = PRINTER_WIDTH) -> str:
    """Pass through text without table transformation - tables are preserved as-is."""
    return text


def format_chunk_header(chunk_text: str, width: int = PRINTER_WIDTH) -> str:
    """Format a [Trecho N] header."""
    lines = chunk_text.split('\n', 1)
    header = lines[0]
    content = lines[1] if len(lines) > 1 else ''

    result = []
    result.append('=' * width)
    result.append(wrap_text(header, width))
    result.append('-' * width)

    if content:
        result.append(wrap_text(content, width))

    return '\n'.join(result)


def add_qr_code(url: str, width: int = PRINTER_WIDTH) -> str:
    """
    Generate QR code for URL (requires qrcode library).

    Note: This is optional - if qrcode is not installed,
    returns a text representation instead.
    """
    try:
        import qrcode
        import io

        qr = qrcode.QRCode(version=1, box_size=1, border=2)
        qr.add_data(url)
        qr.make(fit=True)
        img = qr.make_image()

        # Convert to ASCII art
        buffer = io.StringIO()
        img.save(buffer, format='ASCII')
        ascii_qr = buffer.getvalue()

        # Scale to printer width
        qr_lines = ascii_qr.strip().split('\n')
        max_width = max(len(l) for l in qr_lines)
        scale = min(1.0, (width - 4) / max_width)

        if scale < 1.0:
            scaled_lines = []
            for line in qr_lines:
                scaled_len = int(len(line) * scale)
                if scaled_len < 2:
                    scaled_len = 2
                scaled_lines.append(line[:scaled_len])
            ascii_qr = '\n'.join(scaled_lines)

        return f"\n{ascii_qr}\n[QR: {url}]\n"
    except ImportError:
        return f"\n[QR Code não disponível - instale qrcode library]\n[Link: {url}]\n"


def format_for_print(context: str, qr_url: Optional[str] = None) -> str:
    """
    Format HVAC context for thermal printer.

    Args:
        context: Raw context text from Field Tutor
        qr_url: Optional URL for QR code

    Returns:
        Formatted text ready for thermal printing
    """
    text = nfc_normalize(context)

    # Strip markdown
    text = strip_markdown(text)

    # Process line by line - detect special sections
    lines = text.split('\n')
    result_lines = []
    i = 0

    while i < len(lines):
        line = lines[i].strip()

        # Detect safety procedure section (starts with 📋 or "PROCEDIMENTO DE BLOQUEIO")
        if '📋' in line or 'PROCEDIMENTO DE BLOQUEIO' in line.upper():
            # Collect the whole safety box
            safety_lines = []
            while i < len(lines) and not lines[i].strip().startswith('---'):
                sl = lines[i].strip()
                if sl:
                    safety_lines.append(sl)
                i += 1
            # Skip the --- divider if present
            if i < len(lines) and lines[i].strip().startswith('---'):
                i += 1
            if safety_lines:
                result_lines.append(format_safety_box('\n'.join(safety_lines)))
            continue

        # Detect error code flowchart section
        if 'FLUXO DE DIAGNÓSTICO' in line.upper() or '📊' in line:
            result_lines.append(wrap_text(line))
            i += 1
            continue

        # Detect numbered steps (1. 2. 3. etc)
        if re.match(r'^\d+\.\s+', line):
            # Collect numbered steps
            proc_lines = []
            while i < len(lines) and re.match(r'^\d+\.\s+', lines[i].strip()):
                proc_lines.append(lines[i].strip())
                i += 1
            if proc_lines:
                result_lines.append(format_numbered_procedure('\n'.join(proc_lines)))
            continue

        # Regular content - just wrap
        if line:
            result_lines.append(wrap_text(line))

        i += 1

    # Join and add QR code if provided
    final_text = '\n'.join(result_lines)

    if qr_url:
        final_text += add_qr_code(qr_url)

    return final_text


def format_plain(context: str) -> str:
    """Format context as plain text without printer formatting."""
    text = nfc_normalize(context)
    text = strip_markdown(text)

    # Wrap to printer width
    lines = []
    for line in text.split('\n'):
        lines.append(wrap_text(line.strip()))

    return '\n'.join(lines)


# =============================================================================
# CLI Interface
# =============================================================================

def main():
    import argparse
    import sys

    parser = argparse.ArgumentParser(description="HVAC Formatter — Print output formatter")
    parser.add_argument("--input", "-i", help="Input file (default: stdin)")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    parser.add_argument("--qr", "-q", help="Add QR code with URL")
    parser.add_argument("--plain", "-p", action="store_true", help="Plain text output (no printer formatting)")
    parser.add_argument("--width", "-w", type=int, default=PRINTER_WIDTH, help=f"Line width (default: {PRINTER_WIDTH})")
    args = parser.parse_args()

    # Read input
    if args.input:
        with open(args.input, 'r', encoding='utf-8') as f:
            text = f.read()
    else:
        text = sys.stdin.read()

    # Format
    if args.plain:
        formatted = format_plain(text)
    else:
        formatted = format_for_print(text, qr_url=args.qr)

    # Write output
    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            f.write(formatted)
    else:
        print(formatted)


if __name__ == "__main__":
    main()
