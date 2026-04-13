package youtube

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"regexp"
	"strings"
	"time"
)

// Video represents a YouTube video for HVAC learning
type Video struct {
	ID           string    `json:"id"`
	Title        string    `json:"title"`
	Channel      string    `json:"channel"`
	Duration     int       `json:"duration_seconds"`
	UploadedAt   time.Time `json:"uploaded_at"`
	Transcript   string    `json:"transcript"`
	ErrorCodes   []string  `json:"error_codes"`
	IsDiagnostic bool      `json:"is_diagnostic"`
}

// DiagnosticChannelCriteria defines which channels to include
type DiagnosticChannelCriteria struct {
	Certifications []string // NATE, ASHRAE, etc
	MinSubscribers int
	TopicKeywords  []string
	ExcludeTerms   []string
}

// Pipeline handles YouTube content extraction and indexing
type Pipeline struct {
	criteria DiagnosticChannelCriteria
}

// NewPipeline creates a YouTube learning pipeline
func NewPipeline() *Pipeline {
	return &Pipeline{
		criteria: DiagnosticChannelCriteria{
			Certifications: []string{"NATE", "ASHRAE", "EPA 608"},
			MinSubscribers: 1000,
			TopicKeywords:  []string{"diagnostic", "troubleshooting", "repair", "error code", "HVAC", "split", "inverter"},
			ExcludeTerms:   []string{"review", "unboxing", "price", "buy", "comparison"},
		},
	}
}

// FilterDiagnosticVideos filters videos that are diagnostic/repair focused
func (p *Pipeline) FilterDiagnosticVideos(videos []Video) []Video {
	var filtered []Video

	for _, v := range videos {
		if p.isDiagnostic(&v) {
			filtered = append(filtered, v)
		}
	}

	return filtered
}

// isDiagnostic checks if video meets diagnostic criteria
func (p *Pipeline) isDiagnostic(v *Video) bool {
	// Must be > 5 minutes
	if v.Duration < 300 {
		return false
	}

	upperTitle := strings.ToUpper(v.Title)

	// Check exclude terms
	for _, term := range p.criteria.ExcludeTerms {
		if strings.Contains(upperTitle, strings.ToUpper(term)) {
			return false
		}
	}

	// Check include keywords
	hasKeyword := false
	for _, kw := range p.criteria.TopicKeywords {
		if strings.Contains(upperTitle, strings.ToUpper(kw)) {
			hasKeyword = true
			break
		}
	}

	return hasKeyword
}

// ExtractErrorCodesFromTranscript finds error codes in transcript with timestamps
func (p *Pipeline) ExtractErrorCodesFromTranscript(transcript string) []string {
	patterns := []string{
		`E\d{1,2}`,    // E1, E8, E10
		`CH\d{2}`,     // CH01, CH10
		`F\d{1,2}`,    // F0, F3
		`P\d`,         // P0
		`E\d{3}`,      // E101, E261
		`[A-C]\d`,     // A1, C4
	}

	var codes []string
	seen := make(map[string]bool)

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindAllString(transcript, -1)
		for _, m := range matches {
			upper := strings.ToUpper(m)
			if !seen[upper] {
				codes = append(codes, upper)
				seen[upper] = true
			}
		}
	}

	return codes
}

// ChunkTranscript chunks transcript for RAG indexing with timestamp preservation
func (p *Pipeline) ChunkTranscript(transcript string, chunkSize int) []TranscriptChunk {
	var chunks []TranscriptChunk

	// Split by sentences/paragraphs
	paragraphs := strings.Split(transcript, "\n\n")

	var currentChunk []string
	currentTokens := 0

	for _, para := range paragraphs {
		paraTokens := countTokens(para)

		if currentTokens+paraTokens > chunkSize && len(currentChunk) > 0 {
			// Emit chunk
			chunkText := strings.Join(currentChunk, "\n\n")
			timestamps := extractTimestamps(chunkText)
			errorCodes := p.ExtractErrorCodesFromTranscript(chunkText)

			chunks = append(chunks, TranscriptChunk{
				Text:        chunkText,
				TokenCount:  currentTokens,
				Timestamps:  timestamps,
				ErrorCodes:  errorCodes,
				ContentType: "video_transcript",
			})

			// Start new chunk with overlap
			overlapTokens := chunkSize / 5 // 20% overlap
			currentChunk = getOverlap(currentChunk, overlapTokens)
			currentTokens = countTokens(strings.Join(currentChunk, "\n\n"))
		}

		currentChunk = append(currentChunk, para)
		currentTokens += paraTokens
	}

	// Final chunk
	if len(currentChunk) > 0 {
		chunkText := strings.Join(currentChunk, "\n\n")
		chunks = append(chunks, TranscriptChunk{
			Text:        chunkText,
			TokenCount:  currentTokens,
			Timestamps:  extractTimestamps(chunkText),
			ErrorCodes:  p.ExtractErrorCodesFromTranscript(chunkText),
			ContentType: "video_transcript",
		})
	}

	return chunks
}

// TranscriptChunk represents a chunk of video transcript
type TranscriptChunk struct {
	Text        string   `json:"text"`
	TokenCount  int      `json:"token_count"`
	Timestamps  []string `json:"timestamps"` // extracted timestamps
	ErrorCodes  []string `json:"error_codes"`
	ContentType string   `json:"content_type"`
	VideoID     string   `json:"video_id,omitempty"`
	Channel     string   `json:"channel,omitempty"`
}

// extractTimestamps extracts timestamp mentions from text
func extractTimestamps(text string) []string {
	re := regexp.MustCompile(`(\d{1,2}:\d{2}(?::\d{2})?)`)
	matches := re.FindAllString(text, -1)
	return matches
}

// countTokens approximates token count
func countTokens(text string) int {
	count := 0
	for _, r := range text {
		if r == ' ' || r == '\n' {
			continue
		}
		count++
	}
	return count / 4 // rough approximation
}

// getOverlap returns last portion of chunk for overlap
func getOverlap(chunks []string, maxTokens int) []string {
	var result []string
	tokenCount := 0

	for i := len(chunks) - 1; i >= 0; i-- {
		tokens := countTokens(chunks[i])
		if tokenCount+tokens > maxTokens {
			break
		}
		result = append([]string{chunks[i]}, result...)
		tokenCount += tokens
	}

	return result
}

// FetchCaptions fetches captions for a video using yt-dlp.
// Falls back to YouTube Data API v3 if YOUTUBE_API_KEY is set and yt-dlp unavailable.
func (p *Pipeline) FetchCaptions(ctx context.Context, videoID string) (string, error) {
	// Use yt-dlp to extract subtitles
	cmd := exec.CommandContext(ctx, "yt-dlp",
		"--write-subs",
		"--sub-lang", "pt,en",
		"--skip-download",
		"--output", "/tmp/youtube_caption_%(id)s",
		fmt.Sprintf("https://www.youtube.com/watch?v=%s", videoID))

	output, err := cmd.CombinedOutput()
	if err != nil {
		// Fallback: YouTube Data API v3
		if apiKey := os.Getenv("YOUTUBE_API_KEY"); apiKey != "" {
			return p.fetchCaptionViaAPI(ctx, videoID, apiKey)
		}
		return "", fmt.Errorf("yt-dlp: %w", err)
	}

	// Read the generated subtitle file (prefer Portuguese, fallback to English)
	captionPath := fmt.Sprintf("/tmp/youtube_caption_%s.pt.vtt", videoID)
	if _, err := os.Stat(captionPath); os.IsNotExist(err) {
		captionPath = fmt.Sprintf("/tmp/youtube_caption_%s.en.vtt", videoID)
	}

	data, err := os.ReadFile(captionPath)
	if err != nil {
		return string(output), nil // return yt-dlp output as fallback
	}

	// Parse VTT format to plain text
	text := parseVTT(string(data))
	return text, nil
}

// parseVTT strips VTT tags and timestamps, keeping only text content.
func parseVTT(vtt string) string {
	lines := strings.Split(vtt, "\n")
	var result []string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		// Skip empty lines, timestamps, and VTT tags
		if line == "" || strings.Contains(line, "-->") || strings.HasPrefix(line, "<") {
			continue
		}
		result = append(result, line)
	}
	return strings.Join(result, " ")
}

// fetchCaptionViaAPI uses YouTube Data API v3 to list and describe captions (not download)
func (p *Pipeline) fetchCaptionViaAPI(ctx context.Context, videoID, apiKey string) (string, error) {
	url := fmt.Sprintf("https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=%s&key=%s", videoID, apiKey)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return "", fmt.Errorf("create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("youtube api request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("youtube api: status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Items []struct {
			ID     string `json:"id"`
			Snippet struct {
				Language   string `json:"language"`
				TrackKind  string `json:"trackKind"`
				Name       string `json:"name"`
			} `json:"snippet"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("parse api response: %w", err)
	}

	if len(result.Items) == 0 {
		return "", fmt.Errorf("no captions found for video %s", videoID)
	}

	// Return caption info summary (download requires downstream implementation)
	var info []string
	for _, item := range result.Items {
		info = append(info, fmt.Sprintf("[%s] %s (%s)", item.ID, item.Snippet.Language, item.Snippet.TrackKind))
	}
	return strings.Join(info, "; "), nil
}

// SearchHVACVideos searches for HVAC diagnostic videos
func (p *Pipeline) SearchHVACVideos(ctx context.Context, query string) ([]Video, error) {
	// Primary: YouTube Data API v3
	if apiKey := os.Getenv("GOOGLE_API_KEY"); apiKey != "" {
		return p.searchViaAPI(ctx, apiKey, query)
	}

	// Fallback: yt-dlp scraping
	return p.searchViaYtdlp(ctx, query)
}

// searchViaAPI uses YouTube Data API v3
func (p *Pipeline) searchViaAPI(ctx context.Context, apiKey, query string) ([]Video, error) {
	searchQuery := fmt.Sprintf("%s HVAC diagnostic inverter split troubleshooting", query)
	url := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/search?part=snippet&q=%s&type=video&maxResults=10&key=%s",
		url.QueryEscape(searchQuery), apiKey,
	)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("execute request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API returned status %d", resp.StatusCode)
	}

	var result struct {
		Items []struct {
			ID struct {
				VideoID string `json:"videoId"`
			} `json:"id"`
			Snippet struct {
				Title       string `json:"title"`
				ChannelTitle string `json:"channelTitle"`
				PublishedAt string `json:"publishedAt"`
			} `json:"snippet"`
		} `json:"items"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	var videos []Video
	for _, item := range result.Items {
		uploadedAt, _ := time.Parse(time.RFC3339, item.Snippet.PublishedAt)
		videos = append(videos, Video{
			ID:         item.ID.VideoID,
			Title:      item.Snippet.Title,
			Channel:    item.Snippet.ChannelTitle,
			UploadedAt: uploadedAt,
		})
	}

	return p.filterByChannelCriteria(videos), nil
}

// searchViaYtdlp uses yt-dlp to scrape search results
func (p *Pipeline) searchViaYtdlp(ctx context.Context, query string) ([]Video, error) {
	searchQuery := fmt.Sprintf("ytsearch10:%s HVAC diagnostic inverter split troubleshooting", query)
	cmd := exec.CommandContext(ctx, "yt-dlp",
		"--dump-json",
		"--flat-playlist",
		"--no-playlist",
		searchQuery,
	)

	out, err := cmd.Output()
	if err != nil {
		return nil, fmt.Errorf("yt-dlp execution: %w", err)
	}

	var videos []Video
	lines := strings.Split(strings.TrimSpace(string(out)), "\n")
	for _, line := range lines {
		if line == "" {
			continue
		}
		var entry struct {
			ID       string `json:"id"`
			Title    string `json:"title"`
			Channel  string `json:"channel"`
			Duration int    `json:"duration"`
			Date     string `json:"date"`
		}
		if err := json.Unmarshal([]byte(line), &entry); err != nil {
			continue
		}

		uploadedAt := time.Now()
		if entry.Date != "" {
			if t, err := time.Parse("yyyyMMdd", entry.Date); err == nil {
				uploadedAt = t
			}
		}

		videos = append(videos, Video{
			ID:           entry.ID,
			Title:        entry.Title,
			Channel:      entry.Channel,
			Duration:     entry.Duration,
			UploadedAt:   uploadedAt,
			IsDiagnostic: p.isDiagnosticByTitle(entry.Title),
		})
	}

	return p.filterByChannelCriteria(videos), nil
}

// isDiagnosticByTitle checks if title matches diagnostic criteria
func (p *Pipeline) isDiagnosticByTitle(title string) bool {
	upper := strings.ToUpper(title)
	for _, term := range p.criteria.ExcludeTerms {
		if strings.Contains(upper, strings.ToUpper(term)) {
			return false
		}
	}
	for _, kw := range p.criteria.TopicKeywords {
		if strings.Contains(upper, strings.ToUpper(kw)) {
			return true
		}
	}
	return false
}

// filterByChannelCriteria filters videos by channel certification
func (p *Pipeline) filterByChannelCriteria(videos []Video) []Video {
	var filtered []Video
	for _, v := range videos {
		if p.ValidateChannel(v.Channel) || p.isDiagnosticByTitle(v.Title) {
			filtered = append(filtered, v)
		}
	}
	return filtered
}

// ValidateChannel checks if channel meets certification criteria
func (p *Pipeline) ValidateChannel(channelName string) bool {
	upper := strings.ToUpper(channelName)

	// Check for certification mentions
	for _, cert := range p.criteria.Certifications {
		if strings.Contains(upper, strings.ToUpper(cert)) {
			return true
		}
	}

	return false
}