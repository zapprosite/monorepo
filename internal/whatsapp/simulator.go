package whatsapp

import (
	"context"
	"fmt"
	"os"
)

// SimulatedGraphAPIClient simulates WhatsApp message sending for development/testing.
// Instead of calling the Graph API, it logs messages to stdout.
type SimulatedGraphAPIClient struct {
	PhoneNumberID string
}

// NewSimulatedGraphAPIClient creates a new simulated WhatsApp client.
func NewSimulatedGraphAPIClient() *SimulatedGraphAPIClient {
	return &SimulatedGraphAPIClient{
		PhoneNumberID: "SIMULATED",
	}
}

// SendText simulates sending a text message by logging to stdout.
func (c *SimulatedGraphAPIClient) SendText(ctx context.Context, to, message string) (*SendTextResponse, error) {
	fmt.Printf("[WHATSAPP SIMULATED] To: %s | Message: %s\n", to, message)
	return &SendTextResponse{
		MessagingID: "simulated_msg_id",
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: to},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: "simulated_msg_id"},
		},
	}, nil
}

// SendImage simulates sending an image message.
func (c *SimulatedGraphAPIClient) SendImage(ctx context.Context, to, link, caption string) (*SendTextResponse, error) {
	fmt.Printf("[WHATSAPP SIMULATED] To: %s | Image: %s | Caption: %s\n", to, link, caption)
	return &SendTextResponse{
		MessagingID: "simulated_msg_id",
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: to},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: "simulated_msg_id"},
		},
	}, nil
}

// SendVideo simulates sending a video message.
func (c *SimulatedGraphAPIClient) SendVideo(ctx context.Context, to, link, caption string) (*SendTextResponse, error) {
	fmt.Printf("[WHATSAPP SIMULATED] To: %s | Video: %s | Caption: %s\n", to, link, caption)
	return &SendTextResponse{
		MessagingID: "simulated_msg_id",
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: to},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: "simulated_msg_id"},
		},
	}, nil
}

// SendDocument simulates sending a document message.
func (c *SimulatedGraphAPIClient) SendDocument(ctx context.Context, to, link, filename, caption string) (*SendTextResponse, error) {
	fmt.Printf("[WHATSAPP SIMULATED] To: %s | Document: %s | Filename: %s | Caption: %s\n", to, link, filename, caption)
	return &SendTextResponse{
		MessagingID: "simulated_msg_id",
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: to},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: "simulated_msg_id"},
		},
	}, nil
}

// IsSimulated returns true if WhatsApp is in simulation mode.
func IsSimulated() bool {
	return os.Getenv("SIMULATE_WHATSAPP") == "true"
}
