#!/usr/bin/env python3
"""
Python wrapper for docling table extraction.
Extracts tables from PDFs using docling-fast and outputs JSON.

Usage:
    python tables.py <pdf_path> [-o output.json]
"""

import argparse
import json
import sys
from docling.datamodel.base_models import TableMode
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

def extract_tables(pdf_path: str) -> dict:
    """Extract tables from PDF using docling."""
    pipeline_options = PdfPipelineOptions(tables_mode=TableMode.FAST)

    doc_converter = DocumentConverter(
        format_options={
            "pdf": PdfFormatOption(pipeline_options=pipeline_options)
        }
    )

    result = doc_converter.convert(pdf_path)

    tables = []
    for i, table in enumerate(result.document.export_tables()):
        if table.table_content:
            tables.append({
                "table_index": i,
                "content": table.table_content,
                "bbox": table.bbox.coordinates if hasattr(table, 'bbox') else None,
                "page": table.page_number if hasattr(table, 'page_number') else None,
            })

    return {
        "pdf_path": pdf_path,
        "tables_found": len(tables),
        "tables": tables
    }

def main():
    parser = argparse.ArgumentParser(description="Extract tables from PDF using docling")
    parser.add_argument("pdf_path", help="Path to PDF file")
    parser.add_argument("-o", "--output", help="Output JSON file", default=None)

    args = parser.parse_args()

    try:
        result = extract_tables(args.pdf_path)

        output = args.output or "-"
        if output == "-":
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            with open(output, "w", encoding="utf-8") as f:
                json.dump(result, f, indent=2, ensure_ascii=False)
            print(f"Extracted {len(result['tables'])} tables", file=sys.stderr)

    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
