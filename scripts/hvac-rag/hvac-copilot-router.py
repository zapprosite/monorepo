#!/usr/bin/env python3
"""
HVAC Copilot Router — Main routing engine for HVAC assistance system.

Uses conversation state, graph fallback, and multimodal stack to route
queries to appropriate knowledge sources and generate safe responses.
"""

import asyncio
import httpx
import json
import re
import os
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass, field
from enum import Enum


class RoutingMode(Enum):
    """Available routing modes for HVAC copilot."""
    MANUAL_EXACT = "manual_exact"
    MANUAL_FAMILY = "manual_family"
    GRAPH_ASSISTED = "graph_knowledge"
    WEB_OFFICIAL_ASSISTED = "web_official"
    BLOCKED = "blocked"


@dataclass
class RouteResult:
    """Result of a routing decision."""
    mode: RoutingMode
    response: str
    evidence_level: str
    sources_used: List[str] = field(default_factory=list)
    safety_warnings: List[str] = field(default_factory=list)


@dataclass
class ConversationState:
    """Conversation context and history."""
    conversation_id: str = ""
    user_id: str = ""
    current_model: Optional[str] = None
    current_brand: Optional[str] = None
    current_equipment_type: Optional[str] = None
    recent_queries: List[str] = field(default_factory=list)
    recent_responses: List[str] = field(default_factory=list)
    extracted_entities: Dict[str, Any] = field(default_factory=dict)


@dataclass
class JuezResult:
    """Result from the juez (guardian) safety checker."""
    is_safe: bool
    risk_level: str  # "low", "medium", "high", "critical"
    reason: Optional[str] = None
    requires_warning: bool = False


class CopilotRouter:
    """
    Main router for HVAC copilot system.

    Routes queries to appropriate knowledge sources based on:
    - Conversation state (model, brand, equipment type)
    - Qdrant vector search (exact model or family)
    - Triage graph (yaml-based fallback)
    - Web search (MiniMax MCP or DuckDuckGo fallback)
    - Safety classification (juez)
    """

    # Dangerous operations requiring safety warnings
    DANGEROUS_OPERATIONS = ["IPM", "alta tensão", "capacitor", "compressor"]

    # Short query threshold
    SHORT_QUERY_THRESHOLD = 50

    # Safety patterns requiring blocking
    BLOCKED_PATTERNS = [
        r"\b refrigerante\s+caseiro\b",
        r"\b DIY\s+refrigerante\b",
        r"\b recarregar\s+refrigerante\b",
        r"\b abrir\s+(?:valvula|valvulas)\b",
        r"\b bypass\b",
    ]

    def __init__(
        self,
        state_manager,
        qdrant_client,
        litellm_client,
        minimax_mcp_client
    ):
        """
        Initialize the CopilotRouter.

        Args:
            state_manager: State manager for conversation context
            qdrant_client: Qdrant vector database client
            litellm_client: LiteLLM client for Ollama vision
            minimax_mcp_client: MiniMax MCP client for web search
        """
        self.state_manager = state_manager
        self.qdrant_client = qdrant_client
        self.litellm_client = litellm_client
        self.minimax_mcp_client = minimax_mcp_client
        self._triage_graph = None
        self._graph_loaded = False

    def _load_triage_graph(self) -> Dict[str, Any]:
        """Load triage graph from YAML if not already loaded."""
        if not self._graph_loaded:
            graph_path = os.path.join(
                os.path.dirname(__file__),
                "triage-graph.yaml"
            )
            if os.path.exists(graph_path):
                import yaml
                with open(graph_path, "r", encoding="utf-8") as f:
                    self._triage_graph = yaml.safe_load(f)
            else:
                self._triage_graph = {}
            self._graph_loaded = True
        return self._triage_graph or {}

    def _expand_short_query(
        self,
        query: str,
        conversation_state: ConversationState
    ) -> str:
        """
        Expand short queries with context from conversation state.

        Args:
            query: Original short query
            conversation_state: Current conversation context

        Returns:
            Expanded query with contextual information
        """
        if len(query) >= self.SHORT_QUERY_THRESHOLD:
            return query

        expanded_parts = [query]

        if conversation_state.current_model:
            expanded_parts.append(f"Modelo: {conversation_state.current_model}")

        if conversation_state.current_brand:
            expanded_parts.append(f"Marca: {conversation_state.current_brand}")

        if conversation_state.current_equipment_type:
            expanded_parts.append(
                f"Tipo: {conversation_state.current_equipment_type}"
            )

        # Add relevant entities from previous interactions
        if conversation_state.extracted_entities:
            for key, value in conversation_state.extracted_entities.items():
                if value and key in ["error_code", "symptom", "part_number"]:
                    expanded_parts.append(f"{key}: {value}")

        return " | ".join(expanded_parts)

    def _check_blocked_patterns(self, query: str) -> bool:
        """Check if query matches any blocked patterns."""
        query_lower = query.lower()
        for pattern in self.BLOCKED_PATTERNS:
            if re.search(pattern, query_lower, re.IGNORECASE):
                return True
        return False

    def _needs_safety_warning(
        self,
        query: str,
        has_model: bool
    ) -> List[str]:
        """
        Check if query involves dangerous operations without sufficient context.

        Args:
            query: User query
            has_model: Whether model information is available

        Returns:
            List of safety warnings (empty if none needed)
        """
        warnings = []
        query_lower = query.lower()

        # Check for dangerous operations mentioned
        dangerous_found = [
            op for op in self.DANGEROUS_OPERATIONS
            if op.lower() in query_lower
        ]

        if dangerous_found:
            if not has_model:
                warnings.append(
                    f"AVISO DE SEGURANCA: A operacao '{', '.join(dangerous_found)}' "
                    "requer identificacao precisa do modelo. Sem o modelo correto, "
                    "os valores de tensao, pressao e especificacoes podem variar "
                    "significativamente e causar danos ou ferimentos."
                )

        return warnings

    def _extract_entities_from_query(self, query: str) -> Dict[str, Any]:
        """Extract known entities from query text."""
        entities = {}

        # Extract model patterns (e.g., R32-RXL50, KX125)
        model_pattern = r'\b([A-Z]{2,}[-\s]?[A-Z0-9]{2,}[-\s]?[A-Z0-9]*)\b'
        models = re.findall(model_pattern, query)
        if models:
            entities["potential_models"] = models

        # Extract error codes (e.g., E1, F3, P8)
        error_pattern = r'\b([EFP][0-9]{1,2})\b'
        errors = re.findall(error_pattern, query)
        if errors:
            entities["error_codes"] = errors

        # Extract voltage values
        voltage_pattern = r'\b(\d+)\s*[Vv]\b'
        voltages = re.findall(voltage_pattern, query)
        if voltages:
            entities["voltages"] = [int(v) for v in voltages]

        # Extract pressure values
        pressure_pattern = r'\b(\d+(?:\.\d+)?)\s*(?:kgf|bar|psi)\b'
        pressures = re.findall(pressure_pattern, query)
        if pressures:
            entities["pressures"] = pressures

        return entities

    async def _search_qdrant_exact(
        self,
        query: str,
        model: str
    ) -> Optional[Dict[str, Any]]:
        """
        Search Qdrant with exact model filter.

        Args:
            query: Search query
            model: Exact model identifier

        Returns:
            Search results or None
        """
        try:
            results = await self.qdrant_client.search(
                collection_name="hvac_manuals",
                query_vector=query,
                query_filter={
                    "must": [
                        {"key": "model", "match": {"value": model}}
                    ]
                },
                limit=5
            )
            return results if results else None
        except Exception as e:
            print(f"[WARN] Qdrant exact search failed: {e}")
            return None

    async def _search_qdrant_family(
        self,
        query: str,
        family: str
    ) -> Optional[Dict[str, Any]]:
        """
        Search Qdrant with family filter.

        Args:
            query: Search query
            family: Product family identifier

        Returns:
            Search results or None
        """
        try:
            results = await self.qdrant_client.search(
                collection_name="hvac_manuals",
                query_vector=query,
                query_filter={
                    "must": [
                        {"key": "family", "match": {"value": family}}
                    ]
                },
                limit=5
            )
            return results if results else None
        except Exception as e:
            print(f"[WARN] Qdrant family search failed: {e}")
            return None

    async def _search_web_official(
        self,
        query: str,
        brand: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Search official manufacturer documentation via MiniMax MCP.

        Args:
            query: Search query
            brand: Brand to focus search on

        Returns:
            Web search results or None
        """
        # Build manufacturer-focused search query
        search_query = query
        if brand:
            brand_domains = {
                "daikin": "site:daikin.com.br manual",
                "carrier": "site:carrier.com manual",
                "midea": "site:midea.com manual",
                "LG": "site:lg.com manual",
                "Samsung": "site:samsung.com manual",
            }
            domain_suffix = brand_domains.get(brand.lower(), f"site:{brand.lower()}.com manual")
            search_query = f"{query} {domain_suffix}"
        else:
            # Default to common brands
            search_query = f"{query} site:daikin.com.br OR site:carrier.com.br manual"

        # Try MiniMax MCP first
        try:
            if self.minimax_mcp_client:
                result = await self.minimax_mcp_client.web_search(
                    query=search_query,
                    source="official"
                )
                if result and result.get("results"):
                    return result
        except Exception as e:
            print(f"[WARN] MiniMax MCP web search failed: {e}")

        # Fallback to DuckDuckGo
        return await self._duckduckgo_fallback(search_query)

    async def _duckduckgo_fallback(
        self,
        query: str
    ) -> Optional[Dict[str, Any]]:
        """
        Fallback web search using DuckDuckGo HTML.

        Args:
            query: Search query

        Returns:
            Parsed search results or None
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                # DuckDuckGo HTML interface
                url = "https://html.duckduckgo.com/html/"
                params = {"q": query}
                response = await client.post(url, data=params)

                if response.status_code == 200:
                    # Parse results (simplified)
                    results = []
                    # Simple regex to extract titles and URLs
                    pattern = r'<a class="result__a" href="([^"]+)"[^>]*>([^<]+)</a>'
                    matches = re.findall(pattern, response.text)
                    for url, title in matches[:5]:
                        results.append({"title": title.strip(), "url": url})

                    if results:
                        return {"results": results, "source": "duckduckgo"}
        except Exception as e:
            print(f"[WARN] DuckDuckGo fallback failed: {e}")

        return None

    async def _process_vision(
        self,
        image_data: bytes,
        query: str
    ) -> Dict[str, Any]:
        """
        Process image with Ollama vision model (qwen2.5vl:3b).

        Args:
            image_data: Raw image bytes
            query: User's question about the image

        Returns:
            Vision processing result with extracted entities
        """
        try:
            response = await self.litellm_client.acreate(
                model="qwen2.5vl:3b",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{image_data}"}},
                            {"type": "text", "text": query}
                        ]
                    }
                ],
                temperature=0.1
            )

            extracted = {
                "vision_response": response["choices"][0]["message"]["content"],
                "model": None,
                "error_code": None,
                "part_number": None,
                "label_text": None
            }

            # Extract entities from vision response
            content = extracted["vision_response"]

            # Extract model patterns
            model_match = re.search(r'\b([A-Z]{2,}[-\s]?[A-Z0-9]{2,})\b', content)
            if model_match:
                extracted["model"] = model_match.group(1)

            # Extract error codes
            error_match = re.search(r'\b([EFP][0-9]{1,2})\b', content)
            if error_match:
                extracted["error_code"] = error_match.group(1)

            # Extract part numbers
            part_match = re.search(r'\b(\d{6,}[-\s]?\w*)\b', content)
            if part_match:
                extracted["part_number"] = part_match.group(1)

            return extracted

        except Exception as e:
            print(f"[WARN] Vision processing failed: {e}")
            return {"vision_response": None, "error": str(e)}

    def _lookup_triage_graph(
        self,
        query: str,
        conversation_state: ConversationState
    ) -> Optional[Dict[str, Any]]:
        """
        Lookup triage graph for guided assistance.

        Args:
            query: User query
            conversation_state: Current conversation context

        Returns:
            Graph node data or None
        """
        graph = self._load_triage_graph()
        if not graph:
            return None

        query_lower = query.lower()

        # Extract keywords for matching
        keywords = []
        for key, node in graph.get("nodes", {}).items():
            node_keywords = node.get("keywords", [])
            for kw in node_keywords:
                if kw.lower() in query_lower:
                    keywords.append(key)

        if keywords:
            # Return the most relevant node
            primary_key = keywords[0]
            return graph["nodes"][primary_key]

        # Check by equipment type
        if conversation_state.current_equipment_type:
            equip_key = conversation_state.current_equipment_type.lower()
            if equip_key in graph.get("nodes", {}):
                return graph["nodes"][equip_key]

        return None

    async def route(
        self,
        query: str,
        conversation_state: ConversationState,
        juez_result: Optional[JuezResult] = None,
        image_data: Optional[bytes] = None
    ) -> Dict[str, Any]:
        """
        Route query to appropriate knowledge source and generate response.

        Args:
            query: User query string
            conversation_state: Current conversation context
            juez_result: Safety check result from juez
            image_data: Optional image bytes for vision processing

        Returns:
            Dictionary with:
                - mode: RoutingMode value
                - response: Generated response text
                - evidence_level: Evidence source label
                - sources_used: List of sources consulted
                - safety_warnings: List of safety warnings
        """
        sources_used = []
        safety_warnings = []
        mode = RoutingMode.BLOCKED

        # Handle image input
        vision_extracted = {}
        if image_data:
            vision_extracted = await self._process_vision(image_data, query)
            if vision_extracted.get("model"):
                conversation_state.current_model = vision_extracted["model"]
                conversation_state.extracted_entities["vision_model"] = vision_extracted["model"]
            if vision_extracted.get("error_code"):
                conversation_state.extracted_entities["error_code"] = vision_extracted["error_code"]

        # Expand short queries
        expanded_query = self._expand_short_query(query, conversation_state)

        # Safety check
        if self._check_blocked_patterns(expanded_query):
            mode = RoutingMode.BLOCKED
            return {
                "mode": mode.value,
                "response": (
                    "Esta solicitud foi bloqueada por razoes de seguranca. "
                    "Operacoes com refrigerante, bypass de valvulas ou modificacoes "
                    "caseiras em sistemas HVAC podem ser perigosas e ilegais. "
                    "Consulte um tecnico certificado."
                ),
                "evidence_level": "[fonte: bloqueado]",
                "sources_used": [],
                "safety_warnings": ["Conteudo bloqueado por politica de seguranca"]
            }

        # Check for dangerous operations
        has_model = bool(
            conversation_state.current_model or
            conversation_state.extracted_entities.get("potential_models")
        )
        safety_warnings = self._needs_safety_warning(query, has_model)

        # Extract entities
        entities = self._extract_entities_from_query(expanded_query)
        conversation_state.extracted_entities.update(entities)

        # Try routing based on available context
        response = None
        evidence_level = ""

        # 1. Try MANUAL_EXACT - exact model match
        model_to_search = (
            conversation_state.current_model or
            (entities.get("potential_models", [None]))[0] if entities.get("potential_models") else None
        )

        if model_to_search:
            results = await self._search_qdrant_exact(expanded_query, model_to_search)
            if results:
                mode = RoutingMode.MANUAL_EXACT
                evidence_level = "[fonte: manual exato]"
                sources_used = ["qdrant_exact", "manual_model"]

                # Build response from results
                response = self._build_manual_response(results, model_to_search, query)

                # Add graph disclaimer if using graph knowledge
                if safety_warnings:
                    response += "\n\n" + safety_warnings[0]

                return {
                    "mode": mode.value,
                    "response": response,
                    "evidence_level": evidence_level,
                    "sources_used": sources_used,
                    "safety_warnings": safety_warnings
                }

        # 2. Try MANUAL_FAMILY - family match
        if conversation_state.current_brand or conversation_state.current_equipment_type:
            family = conversation_state.current_brand or conversation_state.current_equipment_type
            results = await self._search_qdrant_family(expanded_query, family)
            if results:
                mode = RoutingMode.MANUAL_FAMILY
                evidence_level = "[fonte: manual da familia]"
                sources_used = ["qdrant_family", "manual_family"]

                response = self._build_family_response(results, family, query)

                if safety_warnings:
                    response += "\n\n" + safety_warnings[0]

                return {
                    "mode": mode.value,
                    "response": response,
                    "evidence_level": evidence_level,
                    "sources_used": sources_used,
                    "safety_warnings": safety_warnings
                }

        # 3. Try GRAPH_ASSISTED - triage graph lookup
        graph_result = self._lookup_triage_graph(expanded_query, conversation_state)
        if graph_result:
            mode = RoutingMode.GRAPH_ASSISTED
            evidence_level = "[fonte: graph interno]"
            sources_used = ["triage_graph"]

            response = graph_result.get("response", "")
            response += "\n\nIsto e uma pista inicial, confirme com o manual do fabricante para valores exatos."

            if safety_warnings:
                response += "\n\n" + safety_warnings[0]

            return {
                "mode": mode.value,
                "response": response,
                "evidence_level": evidence_level,
                "sources_used": sources_used,
                "safety_warnings": safety_warnings
            }

        # 4. Try WEB_OFFICIAL_ASSISTED - web search
        web_results = await self._search_web_official(
            expanded_query,
            conversation_state.current_brand
        )
        if web_results:
            mode = RoutingMode.WEB_OFFICIAL_ASSISTED
            sources_used = ["web_search"]

            if evidence_level:
                evidence_level = f"[fonte: manual + fonte externa]"
            else:
                evidence_level = "[fonte: fonte externa]"

            response = self._build_web_response(web_results, query)

            if safety_warnings:
                response += "\n\n" + safety_warnings[0]

            return {
                "mode": mode.value,
                "response": response,
                "evidence_level": evidence_level,
                "sources_used": sources_used,
                "safety_warnings": safety_warnings
            }

        # Fallback: generic assistance
        mode = RoutingMode.GRAPH_ASSISTED
        evidence_level = "[fonte: graph interno]"
        response = (
            "Preciso de mais informacoes para ajudar melhor. "
            "Qual e o modelo exacto do equipamento? "
            "Isto permite-me dar informacoes mais precisas do manual."
        )

        if safety_warnings:
            response = safety_warnings[0] + "\n\n" + response

        return {
            "mode": mode.value,
            "response": response,
            "evidence_level": evidence_level,
            "sources_used": ["fallback"],
            "safety_warnings": safety_warnings
        }

    def _build_manual_response(
        self,
        results: List[Dict[str, Any]],
        model: str,
        query: str
    ) -> str:
        """Build response from exact model manual results."""
        if not results:
            return f"Modelo {model} encontrado, mas sem informacao relevante."

        # Sort by relevance score
        sorted_results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
        top_result = sorted_results[0]

        content = top_result.get("payload", {}).get("content", "")
        page = top_result.get("payload", {}).get("page", "")

        response = f"Segundo o manual do modelo {model}"
        if page:
            response += f" (pagina {page})"
        response += ":\n\n"
        response += content[:1000]  # Limit response length

        if len(content) > 1000:
            response += "\n\n[Continua no manual...]"

        return response

    def _build_family_response(
        self,
        results: List[Dict[str, Any]],
        family: str,
        query: str
    ) -> str:
        """Build response from family manual results."""
        if not results:
            return f"Familia {family} encontrada, mas sem informacao relevante."

        sorted_results = sorted(results, key=lambda x: x.get("score", 0), reverse=True)
        top_result = sorted_results[0]

        content = top_result.get("payload", {}).get("content", "")
        model_hint = top_result.get("payload", {}).get("model", family)

        response = f"Informacao geral para a familia {family}"
        if model_hint and model_hint != family:
            response += f" (inclui {model_hint})"
        response += ":\n\n"
        response += content[:800]

        response += "\n\nNota: Verifique se o modelo especifico corresponde a estas informacoes."

        return response

    def _build_web_response(
        self,
        web_results: Dict[str, Any],
        query: str
    ) -> str:
        """Build response from web search results."""
        results = web_results.get("results", [])
        source = web_results.get("source", "web")

        if not results:
            return "Busca na web realizada, mas sem resultados relevantes."

        response = "Encontrei documentacao oficial relevante:\n\n"

        for i, result in enumerate(results[:3], 1):
            title = result.get("title", "Sem titulo")
            url = result.get("url", "")
            response += f"{i}. {title}\n   {url}\n\n"

        response += "Recomendo consultar estas fontes oficiais para informacao detalhada."

        return response


# Mock implementations for testing without external dependencies

class MockStateManager:
    """Mock state manager for testing."""

    async def get_state(self, conversation_id: str) -> ConversationState:
        return ConversationState(conversation_id=conversation_id)

    async def update_state(self, state: ConversationState):
        pass


class MockQdrantClient:
    """Mock Qdrant client for testing."""

    async def search(self, collection_name: str, query_vector: Any = None,
                    query_filter: Dict = None, limit: int = 5) -> List[Dict]:
        # Return mock results for testing
        return [
            {
                "score": 0.95,
                "payload": {
                    "content": "Procedimento de manutencao preventiva: Verificar filtro de ar a cada 3 meses.",
                    "page": "45",
                    "model": "R32-RXL50"
                }
            }
        ]


class MockLiteLLMClient:
    """Mock LiteLLM client for testing."""

    async def acreate(self, model: str, messages: List[Dict], temperature: float = 0.1):
        return {
            "choices": [{
                "message": {
                    "content": "Modelo identificado: R32-RXL50. Error code: E1. Placa: ABC123."
                }
            }]
        }


class MockMiniMaxMCPClient:
    """Mock MiniMax MCP client for testing."""

    async def web_search(self, query: str, source: str = "official") -> Dict:
        return {
            "results": [
                {"title": "Daikin R32 Manual", "url": "https://daikin.com.br/manual/r32"},
                {"title": "Carrier Service Manual", "url": "https://carrier.com.br/manual"}
            ],
            "source": "minimax"
        }


async def main():
    """CLI test examples."""
    print("=" * 60)
    print("HVAC Copilot Router - CLI Test")
    print("=" * 60)

    # Initialize router with mock clients
    router = CopilotRouter(
        state_manager=MockStateManager(),
        qdrant_client=MockQdrantClient(),
        litellm_client=MockLiteLLMClient(),
        minimax_mcp_client=MockMiniMaxMCPClient()
    )

    # Test 1: Query with exact model
    print("\n[Test 1] Query with known model:")
    state1 = ConversationState(
        conversation_id="test-001",
        current_model="R32-RXL50",
        current_brand="Daikin"
    )
    result1 = await router.route(
        query="Como fazer manutencao preventiva do filtro?",
        conversation_state=state1,
        juez_result=JuezResult(is_safe=True, risk_level="low")
    )
    print(f"Mode: {result1['mode']}")
    print(f"Evidence: {result1['evidence_level']}")
    print(f"Response: {result1['response'][:200]}...")
    print(f"Sources: {result1['sources_used']}")

    # Test 2: Query without model (safety warning)
    print("\n[Test 2] Query without model (safety):")
    state2 = ConversationState(
        conversation_id="test-002",
        current_brand="Carrier"
    )
    result2 = await router.route(
        query="Como trocar o capacitor do compressor?",
        conversation_state=state2,
        juez_result=JuezResult(is_safe=True, risk_level="medium")
    )
    print(f"Mode: {result2['mode']}")
    print(f"Safety Warnings: {result2['safety_warnings']}")
    print(f"Response: {result2['response'][:200]}...")

    # Test 3: Short query expansion
    print("\n[Test 3] Short query expansion:")
    state3 = ConversationState(
        conversation_id="test-003",
        current_model="KX125",
        current_brand="Daikin",
        current_equipment_type="split",
        extracted_entities={"error_code": "E1"}
    )
    result3 = await router.route(
        query="Erro E1",
        conversation_state=state3,
        juez_result=JuezResult(is_safe=True, risk_level="low")
    )
    print(f"Mode: {result3['mode']}")
    print(f"Response: {result3['response'][:200]}...")

    # Test 4: Blocked content
    print("\n[Test 4] Blocked content:")
    state4 = ConversationState(conversation_id="test-004")
    result4 = await router.route(
        query="Como fazer DIY refrigerante caseiro?",
        conversation_state=state4,
        juez_result=JuezResult(is_safe=False, risk_level="critical")
    )
    print(f"Mode: {result4['mode']}")
    print(f"Response: {result4['response']}")

    # Test 5: Family search
    print("\n[Test 5] Family search:")
    state5 = ConversationState(
        conversation_id="test-005",
        current_brand="Daikin",
        current_equipment_type="split"
    )
    result5 = await router.route(
        query="Pressao normal de trabalho",
        conversation_state=state5,
        juez_result=JuezResult(is_safe=True, risk_level="low")
    )
    print(f"Mode: {result5['mode']}")
    print(f"Evidence: {result5['evidence_level']}")

    # Test 6: Vision processing simulation
    print("\n[Test 6] Vision processing:")
    state6 = ConversationState(conversation_id="test-006")
    # Simulate image processing (would be actual bytes in production)
    result6 = await router.route(
        query="O que significa este erro?",
        conversation_state=state6,
        image_data=b"fake-image-data"
    )
    print(f"Mode: {result6['mode']}")
    print(f"Sources: {result6['sources_used']}")

    print("\n" + "=" * 60)
    print("All tests completed.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
