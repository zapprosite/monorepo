package parser

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

// ----------------------------------------------------------------
// Test helper: minimal PDF files
// ----------------------------------------------------------------

// createTestPDFBytes creates a test PDF using generateMinimalPDF.
// This is sourced from benchmark_test.go's generateMinimalPDF function.
func createTestPDFBytes(t *testing.T, pages int) (string, []byte) {
	t.Helper()
	pdfData, err := generateMinimalPDF(pages)
	if err != nil {
		t.Fatalf("generateMinimalPDF(%d): %v", pages, err)
	}
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, "test.pdf")
	err = os.WriteFile(filePath, pdfData, 0644)
	if err != nil {
		t.Fatalf("WriteFile: %v", err)
	}
	return filePath, pdfData
}

// createTestPDF creates a test PDF file from content string.
// Note: ledongthuc/pdf requires properly formatted PDFs with valid xref tables.
// For valid PDFs, use createTestPDFBytes instead.
func createTestPDF(t *testing.T, name string, content string) string {
	t.Helper()
	tmpDir := t.TempDir()
	filePath := filepath.Join(tmpDir, name)
	err := os.WriteFile(filePath, []byte(content), 0644)
	require.NoError(t, err)
	return filePath
}

// ----------------------------------------------------------------
// Test 1: Open valid PDF
// ----------------------------------------------------------------

func TestPDFParser_NewParser_ValidPDF(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err, "Should create parser for valid PDF")
	require.NotNil(t, parser, "Parser should not be nil")
	defer parser.Close()
}

func TestPDFParser_NewParser_FileNotFound(t *testing.T) {
	_, err := NewPDFParser("/nonexistent/path/manual.pdf")
	require.Error(t, err, "Should return error for non-existent file")
	// Error comes from os.Stat or pdf.Open
	require.True(t, err != nil, "Error should not be nil")
}

func TestPDFParser_NewParser_CorruptedPDF(t *testing.T) {
	// Not a PDF at all
	corrupted := "This is just plain text, not a PDF at all"
	filePath := createTestPDF(t, "corrupted.txt", corrupted)

	_, err := NewPDFParser(filePath)
	require.Error(t, err, "Should return error for corrupted/invalid PDF")
}

// ----------------------------------------------------------------
// Test 2: Extract text from single page
// ----------------------------------------------------------------

func TestPDFParser_ExtractText_SinglePage(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	// Extract text from page 0 (first page)
	text := parser.ExtractText(0)
	// The generated PDF has HVAC content, so should have some text
	t.Logf("Extracted text length: %d", len(text))
}

func TestPDFParser_ExtractText_OutOfRange(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	// Extract text from page that doesn't exist
	text := parser.ExtractText(100)
	require.Equal(t, "", text, "Should return empty string for out-of-range page")
}

func TestPDFParser_ExtractText_NegativePage(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	// Extract text from negative page number
	text := parser.ExtractText(-1)
	require.Equal(t, "", text, "Should return empty string for negative page")
}

// ----------------------------------------------------------------
// Test 3: Extract all pages
// ----------------------------------------------------------------

func TestPDFParser_ExtractAllText_SinglePage(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	pages := parser.ExtractAllText()
	require.NotNil(t, pages, "Should return non-nil slice")
	require.True(t, len(pages) >= 1, "Should have at least 1 page")
}

func TestPDFParser_ExtractAllText_MultiPage(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 5)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	pages := parser.ExtractAllText()
	require.NotNil(t, pages, "Should return non-nil slice")
	t.Logf("5-page PDF extracted into %d page slices", len(pages))
}

// ----------------------------------------------------------------
// Test 4: Handle corrupted PDF (return error)
// ----------------------------------------------------------------

func TestPDFParser_NewParser_TruncatedPDF(t *testing.T) {
	// PDF that starts correctly but is truncated/incomplete
	truncatedPDF := `%PDF-1.4
1 0 obj << /Type /Catalog`

	filePath := createTestPDF(t, "truncated.pdf", truncatedPDF)

	_, err := NewPDFParser(filePath)
	// Truncated PDF - may fail to parse
	require.Error(t, err, "Should return error for truncated PDF")
}

func TestPDFParser_NewParser_WrongMagicBytes(t *testing.T) {
	// File with wrong magic bytes (looks like PDF but isn't)
	wrongMagic := `%PPT-1.4
some content`

	filePath := createTestPDF(t, "wrong_magic.ppt", wrongMagic)

	_, err := NewPDFParser(filePath)
	require.Error(t, err, "Should return error for non-PDF file")
}

func TestPDFParser_NewParser_EmptyFile(t *testing.T) {
	tmpDir := t.TempDir()
	emptyPath := filepath.Join(tmpDir, "empty.pdf")
	err := os.WriteFile(emptyPath, []byte{}, 0644)
	require.NoError(t, err)

	_, err = NewPDFParser(emptyPath)
	require.Error(t, err, "Should return error for empty file")
}

// ----------------------------------------------------------------
// Test 5: Handle password-protected PDF (return error)
// ----------------------------------------------------------------

// GAP: ledongthuc/pdf may or may not handle password-protected PDFs.
// This test documents the expected behavior.

func TestPDFParser_NewParser_PasswordProtectedPDF(t *testing.T) {
	// A PDF that requires password would have /Encrypt in trailer
	passwordPDF := `%PDF-1.4
1 0 obj << /Type /Catalog /Pages 2 0 R /Encrypt 5 0 R >> endobj
2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj
3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >> endobj
5 0 obj << /Filter /Standard /V 2 /R 3 >> endobj
xref
0 6
trailer << /Root 1 0 R /Encrypt 5 0 R /Size 6 >>
startxref
250
%%EOF`

	filePath := createTestPDF(t, "encrypted.pdf", passwordPDF)

	_, err := NewPDFParser(filePath)
	// ledongthuc/pdf may return an error for encrypted PDFs
	// The specific error type/message depends on the library implementation
	if err != nil {
		t.Logf("Password-protected PDF returned error (expected): %v", err)
	}
	// Note: Some PDF libraries may silently succeed but return no text
	// This is a known gap - password protection handling varies by library
}

// ----------------------------------------------------------------
// Test 6: Page count accuracy
// ----------------------------------------------------------------

func TestPDFParser_PageCount_SinglePage(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	count := parser.PageCount()
	require.Equal(t, 1, count, "Single page PDF should have count of 1")
}

func TestPDFParser_PageCount_MultiPage5(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 5)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)
	defer parser.Close()

	count := parser.PageCount()
	require.Equal(t, 5, count, "5-page PDF should report count of 5")
}

func TestPDFParser_PageCount_NilReader(t *testing.T) {
	parser := &PDFParser{
		filePath: "/some/path.pdf",
		reader:   nil, // Not initialized
	}

	count := parser.PageCount()
	require.Equal(t, 0, count, "Nil reader should return 0 pages")
}

// ----------------------------------------------------------------
// Test: ExtractText with nil reader
// ----------------------------------------------------------------

func TestPDFParser_ExtractText_NilReader(t *testing.T) {
	parser := &PDFParser{
		filePath: "/some/path.pdf",
		reader:   nil,
	}

	text := parser.ExtractText(0)
	require.Equal(t, "", text, "Nil reader should return empty string")
}

// ----------------------------------------------------------------
// Test: Close
// ----------------------------------------------------------------

func TestPDFParser_Close(t *testing.T) {
	filePath, _ := createTestPDFBytes(t, 1)

	parser, err := NewPDFParser(filePath)
	require.NoError(t, err)

	err = parser.Close()
	require.NoError(t, err, "Close should not return error")

	// After close, operations should return empty/nil
	count := parser.PageCount()
	require.Equal(t, 0, count, "After close, page count should be 0")
}

// ----------------------------------------------------------------
// Integration tests with real PDFs (if available)
// ----------------------------------------------------------------

func TestPDFParser_Integration_WithRealPDF(t *testing.T) {
	// These tests would require actual PDF files
	// Skip unless explicitly running integration tests

	if testing.Short() {
		t.Skip("Skipping integration test in short mode")
	}

	// Try to find any PDF in testdata or current directory
	testPaths := []string{
		"./testdata/manual.pdf",
		"./testdata/hvac.pdf",
		"./test.pdf",
	}

	for _, path := range testPaths {
		if _, err := os.Stat(path); err == nil {
			parser, err := NewPDFParser(path)
			if err != nil {
				t.Logf("Failed to open %s: %v", path, err)
				continue
			}
			defer parser.Close()

			count := parser.PageCount()
			t.Logf("Opened %s: %d pages", path, count)

			text := parser.ExtractText(0)
			if len(text) > 0 {
				t.Logf("First page text preview: %s...", text[:min(100, len(text))])
			}
			return // Successfully opened one
		}
	}

	t.Skip("No test PDF files found")
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
