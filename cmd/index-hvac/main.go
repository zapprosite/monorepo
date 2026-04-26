package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/google/uuid"
	"github.com/qdrant/go-client/qdrant"
)

// HVACDocument represents a sample HVAC document for indexing
type HVACDocument struct {
	Brand       string
	Model       string
	Category    string // error_code, procedure, spec, wiring
	Title       string
	Content     string
	Section     string
}

// Sample HVAC documents for indexing
var sampleDocuments = []HVACDocument{
	{
		Brand:    "Springer",
		Model:    "Springer Air Evolution",
		Category: "spec",
		Title:    "Capacidade de Refrigeração",
		Section:  "SPECS",
		Content: `Springer Air Evolution 12.000 BTU/h
Capacidade de refrigeração: 12.000 BTU/h (3.520 W)
Capacidade de aquecimento: 12.000 BTU/h (3.520 W)
EER: 3,21 W/W
Consumo energético: 1.096 W
Gás refrigerante: R-410A
Voltagem: 220V/60Hz
Dimensões unidade interna: 805x285x195 mm
Dimensões unidade externa: 700x550x270 mm
Peso unidade interna: 8,5 kg
Peso unidade externa: 27 kg`,
	},
	{
		Brand:    "Springer",
		Model:    "Springer Air Evolution",
		Category: "error_code",
		Title:    "Códigos de Erro Springer Air Evolution",
		Section:  "ERROR_CODES",
		Content: `Springer Air Evolution - Códigos de Erro

E1 - Erro de comunicação entre unidade interna e externa
E2 - Erro no sensor de temperatura ambiente
E3 - Erro no sensor de temperatura de evaporação
E4 - Erro no sensor de temperatura de condensação
E5 - Sobrecarga no compressor
E6 - Erro no motor do ventilador da unidade interna
E7 - Erro no motor do ventilador da unidade externa
F1 - Erro na válvula de expansão eletrônica
F2 - Sobreaquecimento da unidade externa
F3 - Baixo fluxo de ar
F4 - Erro no ciclo de descongelamento`,
	},
	{
		Brand:    "LG",
		Model:    "LG Dual Inverter",
		Category: "procedure",
		Title:    "Procedimento de Limpeza do Filtro",
		Section:  "MAINTENANCE",
		Content: `Procedimento de Limpeza do Filtro - LG Dual Inverter

1. Desligue o aparelho usando o controle remoto
2. Aguarde 5 minutos para o compressor descansar
3. Abra o painel frontal da unidade interna
4. Remova os filtros de ar轻轻地
5. Lave os filtros com água morna e sabão neutro
6. Não use água quente (>40°C) ou produtos químicos agressivos
7. Deixe os filtros secarem completamente à sombra
8. Reinstale os filtros na posição correta
9. Feche o painel frontal
10. Ligue o aparelho e selecione a função desired

Frequência recomendada: a cada 2 semanas ou conforme necessidade`,
	},
	{
		Brand:    "Samsung",
		Model:    "Samsung WindFree",
		Category: "error_code",
		Title:    "Códigos de Erro Samsung WindFree",
		Section:  "ERROR_CODES",
		Content: `Samsung WindFree - Códigos de Erro

E101 - Erro de comunicação interna/externa
E201 - Sensor de temperatura ambiente aberto
E202 - Sensor de temperatura do evaporador aberto
E301 - Erro no sensor de descarga
E401 - Erro de partida do compressor
E402 - Erro de proteção do compressor
E501 - Erro na unidade externa (OCP)
E601 - Erro de temperatura ambiente anomalously
E701 - Erro no motor do ventilador externo
F001 - Erro de EEPROM
P1 - Protecção de alta pressão
P2 - Protecção de baixa pressão`,
	},
	{
		Brand:    "Springer",
		Model:    "Springer Hi-Wall",
		Category: "procedure",
		Title:    "Instalação Springer Hi-Wall 9000 BTU",
		Section:  "INSTALLATION",
		Content: `Guia de Instalação Springer Hi-Wall 9000 BTU

Localização da Unidade Interna:
- Altura mínima: 2,0m do piso
- Distância mínima do teto: 10cm
- Distância mínima das paredes: 15cm cada lado
- Evitar exposição direta ao sol
- Não instalar perto de fontes de calor

Localização da Unidade Externa:
- Local ventilado e sombreado
- Distância mínima de 50cm de paredes
- Superfície plana e firme
- Acesso para manutenção
- Evitar locais muito quentes ou fríos extremos

Tubulação de Cobre:
- Bitola: 1/4" (líquido) e 3/8" (sucção)
- Isolamento térmico obrigatório
- Raio de curvatura mínimo: 10cm
- Carga de gás: ver etiqueta do produto`,
	},
	{
		Brand:    "LG",
		Model:    "LG Art Cool",
		Category: "spec",
		Title:    "Especificações LG Art Cool Mirror",
		Section:  "SPECS",
		Content: `LG Art Cool Mirror - Especificações Técnicas

Capacidade: 9.000 BTU/h (2.637 W)
Capacidade heating: 10.000 BTU/h (2.930 W)
EER: 3,45 W/W
Consumo: 765 W
COP: 3,83 W/W
Gás refrigerante: R-32
Voltagem: 220V/60Hz
Corrente nominal: 3,5 A
Dimensões interno: 885x285x198 mm
Dimensões externo: 717x483x230 mm
Peso interno: 9,2 kg
Peso externo: 26,3 kg
Nível de ruído interno: 22-39 dB(A)
Nível de ruído externo: 48 dB(A)`,
	},
	{
		Brand:    "Springer",
		Model:    "Springer Floor Standing",
		Category: "procedure",
		Title:    "Manutenção Preventiva Springer",
		Section:  "MAINTENANCE",
		Content: `Manual de Manutenção Preventiva - Springer

Inspeção Mensal:
- Verificar funcionamento do controle remoto
- Limpar filtros de ar
- Verificar ausência de ruídos estranhos
- Observar se há goteiras

Inspeção Trimestral:
- Limpar bobinas do evaporador
- Verificar conexões eléctricas
- Medir tensão de alimentação
- Verificar fixing da unidade externa

Inspeção Anual (profissional):
- Limpeza completa das unidades
- Verificação do gás refrigerante
- Teste de desempenho
- Verificação da válvula de expansão
- Medição de corrente do compressor`,
	},
	{
		Brand:    "Samsung",
		Model:    "Samsung Console",
		Category: "spec",
		Title:    "Especificações Samsung Console 18.000 BTU",
		Section:  "SPECS",
		Content: `Samsung Console 18.000 BTU - Especificações

Capacidade refrigeração: 18.000 BTU/h (5.275 W)
Capacidade aquecimento: 20.000 BTU/h (5.860 W)
EER: 3,12 W/W
Consumo energético: 1.691 W
COP: 3,47 W/W
Gás refrigerante: R-410A
Voltagem: 220V/60Hz
Dimensões console: 1.200x700x200 mm
Peso: 32 kg
Nível de ruído: 28-42 dB(A)
Área recomendada: 25-35 m²`,
	},
}

// OllamaEmbedder handles embedding generation
type OllamaEmbedder struct {
	baseURL string
	model   string
	client  *http.Client
}

// NewOllamaEmbedder creates a new embedder
func NewOllamaEmbedder(baseURL, model string) *OllamaEmbedder {
	return &OllamaEmbedder{
		baseURL: baseURL,
		model:   model,
		client: &http.Client{
			Timeout: 60 * time.Second,
		},
	}
}

// EmbedRequest for Ollama
type EmbedRequest struct {
	Model  string `json:"model"`
	Prompt string `json:"prompt"`
}

// EmbedResponse from Ollama
type EmbedResponse struct {
	Embedding []float32 `json:"embedding"`
}

// Embed generates embedding for text
func (e *OllamaEmbedder) Embed(ctx context.Context, text string) ([]float32, error) {
	reqBody := EmbedRequest{
		Model:  e.model,
		Prompt: text,
	}

	jsonBody, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("marshal request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", e.baseURL+"/api/embeddings", bytes.NewBuffer(jsonBody))
	if err != nil {
		return nil, fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := e.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	var respBody EmbedResponse
	if err := json.NewDecoder(resp.Body).Decode(&respBody); err != nil {
		return nil, fmt.Errorf("decode response: %w", err)
	}

	return respBody.Embedding, nil
}

// QdrantClient wraps Qdrant operations
type QdrantClient struct {
	client     *qdrant.Client
	collection string
}

// NewQdrantClient creates a new Qdrant client
func NewQdrantClient(addr, collection string) (*QdrantClient, error) {
	host := addr
	port := 6334
	if idx := len(addr) - 1; idx > 0 {
		for idx > 0 && addr[idx] != ':' {
			idx--
		}
		if idx > 0 && addr[idx] == ':' {
			host = addr[:idx]
			fmt.Sscanf(addr[idx+1:], "%d", &port)
		}
	}

	apiKey := os.Getenv("QDRANT_API_KEY")
	client, err := qdrant.NewClient(&qdrant.Config{
		Host:                   host,
		Port:                   port,
		APIKey:                 apiKey,
		SkipCompatibilityCheck: true,
	})
	if err != nil {
		return nil, fmt.Errorf("qdrant client: %w", err)
	}

	return &QdrantClient{
		client:     client,
		collection: collection,
	}, nil
}

// CreateCollection creates collection with 768D vectors (nomic-embed-text)
func (c *QdrantClient) CreateCollection(ctx context.Context, vectorSize uint64) error {
	exists, err := c.client.CollectionExists(ctx, c.collection)
	if err != nil {
		return fmt.Errorf("check exists: %w", err)
	}
	if exists {
		log.Printf("Collection %s already exists", c.collection)
		return nil
	}

	defaultSegmentNumber := uint64(2)
	req := &qdrant.CreateCollection{
		CollectionName: c.collection,
		VectorsConfig: qdrant.NewVectorsConfig(&qdrant.VectorParams{
			Size:     vectorSize,
			Distance: qdrant.Distance_Cosine,
		}),
		OptimizersConfig: &qdrant.OptimizersConfigDiff{
			DefaultSegmentNumber: &defaultSegmentNumber,
		},
	}

	if err := c.client.CreateCollection(ctx, req); err != nil {
		return fmt.Errorf("create collection: %w", err)
	}

	log.Printf("Created collection %s with %dD vectors", c.collection, vectorSize)
	return nil
}

// UpsertPoint inserts a point into the collection
func (c *QdrantClient) UpsertPoint(ctx context.Context, id string, vector []float32, payload map[string]any) error {
	pt := &qdrant.PointStruct{
		Id:      qdrant.NewID(id),
		Vectors: qdrant.NewVectors(vector...),
		Payload: qdrant.NewValueMap(payload),
	}

	waitUpsert := true
	req := &qdrant.UpsertPoints{
		CollectionName: c.collection,
		Points:        []*qdrant.PointStruct{pt},
		Wait:          &waitUpsert,
	}

	_, err := c.client.Upsert(ctx, req)
	if err != nil {
		return fmt.Errorf("upsert: %w", err)
	}

	return nil
}


func main() {
	ollamaURL := flag.String("ollama", "http://localhost:11434", "Ollama API URL")
	qdrantAddr := flag.String("qdrant", "10.0.19.2:6333", "Qdrant address")
	collection := flag.String("collection", "hvacr_knowledge", "Collection name")
	model := flag.String("model", "nomic-embed-text", "Embedding model")
	flag.Parse()

	ctx := context.Background()

	log.Printf("Connecting to Ollama at %s", *ollamaURL)
	log.Printf("Connecting to Qdrant at %s", *qdrantAddr)
	log.Printf("Using collection: %s", *collection)

	// Initialize embedder
	embedder := NewOllamaEmbedder(*ollamaURL, *model)

	// Test Ollama connection
	log.Printf("Testing Ollama connection...")
	testVec, err := embedder.Embed(ctx, "test")
	if err != nil {
		log.Fatalf("Failed to connect to Ollama: %v", err)
	}
	vectorSize := uint64(len(testVec))
	log.Printf("Ollama connected. Embedding dimension: %d", vectorSize)

	// Initialize Qdrant client
	qdrantClient, err := NewQdrantClient(*qdrantAddr, *collection)
	if err != nil {
		log.Fatalf("Failed to create Qdrant client: %v", err)
	}

	// Create collection
	if err := qdrantClient.CreateCollection(ctx, vectorSize); err != nil {
		log.Fatalf("Failed to create collection: %v", err)
	}

	// Index documents
	log.Printf("Indexing %d sample HVAC documents...", len(sampleDocuments))
	indexed := 0

	for _, doc := range sampleDocuments {
		// Create unique ID (UUID format for Qdrant)
		id := uuid.New().String()

		// Prepare payload
		payload := map[string]any{
			"brand":        doc.Brand,
			"model":        doc.Model,
			"category":     doc.Category,
			"title":        doc.Title,
			"content":      doc.Content,
			"section":      doc.Section,
		}

		// Generate embedding
		vector, err := embedder.Embed(ctx, doc.Content)
		if err != nil {
			log.Printf("Failed to embed document %s: %v", id, err)
			continue
		}

		// Upsert to Qdrant
		if err := qdrantClient.UpsertPoint(ctx, id, vector, payload); err != nil {
			log.Printf("Failed to upsert document %s: %v", id, err)
			continue
		}

		log.Printf("Indexed: [%s] %s - %s", doc.Brand, doc.Category, doc.Title)
		indexed++
	}

	log.Printf("Successfully indexed %d/%d documents", indexed, len(sampleDocuments))
	log.Println("Indexing complete!")
	os.Exit(0)
}
