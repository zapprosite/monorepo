package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

// GraphAPIClient sends messages via the Facebook WhatsApp Cloud API.
type GraphAPIClient struct {
	PhoneNumberID string
	AccessToken   string
	HTTPClient    *http.Client
	BaseURL       string
}

// NewGraphAPIClient creates a new WhatsApp Cloud API client.
func NewGraphAPIClient(phoneNumberID, accessToken string) *GraphAPIClient {
	return &GraphAPIClient{
		PhoneNumberID: phoneNumberID,
		AccessToken:  accessToken,
		HTTPClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		BaseURL: "https://graph.facebook.com/v21.0",
	}
}

// SendTextRequest represents a text message request to the WhatsApp Cloud API.
type SendTextRequest struct {
	MessagingProduct string `json:"messaging_product"`
	RecipientType    string `json:"recipient_type"`
	To               string `json:"to"`
	Type             string `json:"type"`
	Text             struct {
		PreviewURL bool   `json:"preview_url"`
		Body       string `json:"body"`
	} `json:"text"`
}

// SendTextResponse represents the response from the WhatsApp Cloud API.
type SendTextResponse struct {
	MessagingID string `json:"messaging_product"`
	Contacts    []struct {
		WAID string `json:"wa_id"`
	} `json:"contacts"`
	Messages []struct {
		ID string `json:"id"`
	} `json:"messages"`
}

// SendText sends a text message to a WhatsApp user.
func (c *GraphAPIClient) SendText(ctx context.Context, to, message string) (*SendTextResponse, error) {
	reqBody := SendTextRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               to,
		Type:             "text",
	}
	reqBody.Text.PreviewURL = false
	reqBody.Text.Body = message

	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/%s/messages", c.BaseURL, c.PhoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var result SendTextResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}

// SendMediaRequest represents a media message request.
type SendMediaRequest struct {
	MessagingProduct string `json:"messaging_product"`
	RecipientType    string `json:"recipient_type"`
	To               string `json:"to"`
	Type             string `json:"type"`
	Image            struct {
		Link string `json:"link"`
		ID   string `json:"id,omitempty"`
		Caption string `json:"caption,omitempty"`
	} `json:"image,omitempty"`
	Video struct {
		Link string `json:"link"`
		ID   string `json:"id,omitempty"`
		Caption string `json:"caption,omitempty"`
	} `json:"video,omitempty"`
	Document struct {
		Link        string `json:"link"`
		ID          string `json:"id,omitempty"`
		Caption     string `json:"caption,omitempty"`
		Filename    string `json:"filename,omitempty"`
	} `json:"document,omitempty"`
}

// SendImage sends an image message.
func (c *GraphAPIClient) SendImage(ctx context.Context, to, link, caption string) (*SendTextResponse, error) {
	reqBody := SendMediaRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               to,
		Type:             "image",
	}
	reqBody.Image.Link = link
	reqBody.Image.Caption = caption

	return c.sendMedia(ctx, reqBody)
}

// SendVideo sends a video message.
func (c *GraphAPIClient) SendVideo(ctx context.Context, to, link, caption string) (*SendTextResponse, error) {
	reqBody := SendMediaRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               to,
		Type:             "video",
	}
	reqBody.Video.Link = link
	reqBody.Video.Caption = caption

	return c.sendMedia(ctx, reqBody)
}

// SendDocument sends a document message.
func (c *GraphAPIClient) SendDocument(ctx context.Context, to, link, filename, caption string) (*SendTextResponse, error) {
	reqBody := SendMediaRequest{
		MessagingProduct: "whatsapp",
		RecipientType:    "individual",
		To:               to,
		Type:             "document",
	}
	reqBody.Document.Link = link
	reqBody.Document.Filename = filename
	reqBody.Document.Caption = caption

	return c.sendMedia(ctx, reqBody)
}

func (c *GraphAPIClient) sendMedia(ctx context.Context, reqBody SendMediaRequest) (*SendTextResponse, error) {
	payload, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	url := fmt.Sprintf("%s/%s/messages", c.BaseURL, c.PhoneNumberID)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(payload))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.AccessToken)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("send request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
	}

	var result SendTextResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return &result, nil
}
