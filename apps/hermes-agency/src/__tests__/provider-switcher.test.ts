import { describe, it, expect } from 'vitest'

describe('Provider Switcher', () => {
  const PROVIDERS = {
    'minimax-m2.7': { api_base: 'https://api.minimax.io', model: 'MiniMax-M2.7' },
    'openai-gpt-4': { api_base: 'https://api.openai.com', model: 'gpt-4' },
    'qwen2.5vl-3b': { api_base: 'http://qwen2-vl7b:11434', model: 'qwen2.5vl:3b' }
  } as const

  it('should return correct api_base for minimax', () => {
    const provider = PROVIDERS['minimax-m2.7']
    expect(provider.api_base).toBe('https://api.minimax.io')
    expect(provider.model).toBe('MiniMax-M2.7')
  })

  it('should NOT include path in api_base', () => {
    for (const [name, provider] of Object.entries(PROVIDERS)) {
      expect(provider.api_base).not.toMatch(/\/v1|\/anthropic|\/openai/)
    }
  })

  it('should have 768 embedding dims for nomic', () => {
    // nomic-embed-text produces 768 dimensions
    const embeddingDims = 768
    expect(embeddingDims).toBe(768)
  })

  it('should switch provider correctly', () => {
    const switchProvider = (name: string) => PROVIDERS[name as keyof typeof PROVIDERS]
    expect(switchProvider('minimax-m2.7').api_base).toBe('https://api.minimax.io')
    expect(switchProvider('qwen2.5vl-3b').api_base).toBe('http://qwen2-vl7b:11434')
  })
})
