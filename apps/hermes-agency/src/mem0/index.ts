// Mem0 Client — exports
export {
  mem0Store,
  mem0GetRecent,
  mem0Search,
  mem0Delete,
  mem0CleanupExpired,
  formatMem0Context,
  addToSessionHistory,
  getSessionHistory,
  type Mem0Entry,
  type MemoryImportance,
} from './client.js';

export {
  longTermMemoryStore,
  longTermMemoryGet,
  longTermMemorySearch,
  longTermMemoryDelete,
  longTermMemoryUpdate,
  storeClientPreference,
  storeBrandGuideline,
  storeCampaignContext,
  getClientMemory,
  searchAllAgencyMemory,
  formatLongTermContext,
  type LongTermMemoryEntry,
  type LongTermMemoryType,
} from './longterm.js';

export {
  generateEmbedding,
  generateEmbeddings,
  generatePseudoEmbedding,
  cosineSimilarity,
} from './embeddings.js';
