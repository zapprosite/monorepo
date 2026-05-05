"""
Nexus Config — Environment configuration
"""
import os

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://localhost:11434")
LITELLM_URL = os.environ.get("LITELLM_URL", "http://localhost:4018")
QDRANT_URL = os.environ.get("QDRANT_URL", "http://localhost:6333")

NEXUS_DEFAULT_MODEL = os.environ.get("NEXUS_DEFAULT_MODEL", "hermes-auto")
NEXUS_CLASSIFIER_MODEL = os.environ.get("NEXUS_CLASSIFIER_MODEL", "hermes-auto")
NEXUS_VALIDATOR_MODEL = os.environ.get("NEXUS_VALIDATOR_MODEL", "hermes-cloud-chat")

HCE_API_URL = os.environ.get("HCE_API_URL", "http://localhost:8642")
