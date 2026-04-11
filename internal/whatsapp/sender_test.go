package whatsapp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/stretchr/testify/require"
)

const testPhoneNumberID = "123456789"
const testAccessToken = "test-access-token"

func TestSendText(t *testing.T) {
	expectedResponse := SendTextResponse{
		MessagingID: "whatsapp",
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: "5511999887766"},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: "wamid.outbound"},
		},
	}

	var receivedReq SendTextRequest
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Verify headers
		require.Equal(t, "Bearer "+testAccessToken, r.Header.Get("Authorization"))
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))

		// Parse request
		err := json.NewDecoder(r.Body).Decode(&receivedReq)
		require.NoError(t, err)

		// Verify request fields
		require.Equal(t, "whatsapp", receivedReq.MessagingProduct)
		require.Equal(t, "individual", receivedReq.RecipientType)
		require.Equal(t, "5511999887766", receivedReq.To)
		require.Equal(t, "text", receivedReq.Type)
		require.Equal(t, "Test message content", receivedReq.Text.Body)
		require.False(t, receivedReq.Text.PreviewURL)

		// Send response
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(expectedResponse)
	}))
	defer server.Close()

	client := NewGraphAPIClient(testPhoneNumberID, testAccessToken)
	client.BaseURL = server.URL

	resp, err := client.SendText(context.Background(), "5511999887766", "Test message content")
	require.NoError(t, err)
	require.NotNil(t, resp)
	require.Equal(t, "wamid.outbound", resp.Messages[0].ID)
	require.Equal(t, "5511999887766", resp.Contacts[0].WAID)
}

func TestSendText_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{"error": "unauthorized"})
	}))
	defer server.Close()

	client := NewGraphAPIClient(testPhoneNumberID, testAccessToken)
	client.BaseURL = server.URL

	resp, err := client.SendText(context.Background(), "5511999887766", "Test message")
	require.Error(t, err)
	require.Nil(t, resp)
	require.Contains(t, err.Error(), "unexpected status: 401")
}

func TestSendText_ContextCancellation(t *testing.T) {
	client := NewGraphAPIClient(testPhoneNumberID, testAccessToken)
	client.BaseURL = "http://127.0.0.1:1" // Invalid address to force context cancellation

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // Cancel immediately

	resp, err := client.SendText(ctx, "5511999887766", "Test message")
	require.Error(t, err)
	require.Nil(t, resp)
}

func TestSendMedia(t *testing.T) {
	expectedResponse := SendTextResponse{
		MessagingID: "whatsapp",
		Contacts: []struct {
			WAID string `json:"wa_id"`
		}{
			{WAID: "5511999887766"},
		},
		Messages: []struct {
			ID string `json:"id"`
		}{
			{ID: "wamid.media.outbound"},
		},
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		require.Equal(t, "Bearer "+testAccessToken, r.Header.Get("Authorization"))
		require.Equal(t, "application/json", r.Header.Get("Content-Type"))

		var reqBody SendMediaRequest
		err := json.NewDecoder(r.Body).Decode(&reqBody)
		require.NoError(t, err)
		require.Equal(t, "whatsapp", reqBody.MessagingProduct)
		require.Equal(t, "individual", reqBody.RecipientType)
		require.Equal(t, "5511999887766", reqBody.To)

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(expectedResponse)
	}))
	defer server.Close()

	client := NewGraphAPIClient(testPhoneNumberID, testAccessToken)
	client.BaseURL = server.URL

	t.Run("SendImage", func(t *testing.T) {
		resp, err := client.SendImage(context.Background(), "5511999887766", "https://example.com/image.jpg", "Check this out")
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "wamid.media.outbound", resp.Messages[0].ID)
	})

	t.Run("SendVideo", func(t *testing.T) {
		resp, err := client.SendVideo(context.Background(), "5511999887766", "https://example.com/video.mp4", "Watch this")
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "wamid.media.outbound", resp.Messages[0].ID)
	})

	t.Run("SendDocument", func(t *testing.T) {
		resp, err := client.SendDocument(context.Background(), "5511999887766", "https://example.com/doc.pdf", "report.pdf", "Monthly report")
		require.NoError(t, err)
		require.NotNil(t, resp)
		require.Equal(t, "wamid.media.outbound", resp.Messages[0].ID)
	})
}

func TestSendMedia_APIError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(map[string]string{"error": "invalid media link"})
	}))
	defer server.Close()

	client := NewGraphAPIClient(testPhoneNumberID, testAccessToken)
	client.BaseURL = server.URL

	resp, err := client.SendImage(context.Background(), "5511999887766", "invalid-link", "Caption")
	require.Error(t, err)
	require.Nil(t, resp)
	require.Contains(t, err.Error(), "unexpected status: 400")
}

func TestSendMedia_ContextCancellation(t *testing.T) {
	client := NewGraphAPIClient(testPhoneNumberID, testAccessToken)
	client.BaseURL = "http://127.0.0.1:1"

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	resp, err := client.SendImage(ctx, "5511999887766", "https://example.com/image.jpg", "Caption")
	require.Error(t, err)
	require.Nil(t, resp)
}
