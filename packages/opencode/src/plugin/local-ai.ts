import type { Hooks, PluginInput } from "@opencode-ai/plugin"
import { Log } from "../util/log"

const log = Log.create({ service: "plugin.local-ai" })

/**
 * Local AI Plugin
 * 
 * Provides support for local AI models (Qwen, Ollama, etc.)
 * This plugin registers local providers without modifying core provider.ts
 */

export interface LocalProviderConfig {
  id: string
  name: string
  baseURL: string
  models: Record<string, LocalModelConfig>
}

export interface LocalModelConfig {
  id: string
  name: string
  providerID: string
  capabilities: {
    temperature: boolean
    reasoning: boolean
    attachment: boolean
    toolcall: boolean
    input: {
      text: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
    output: {
      text: boolean
      audio: boolean
      image: boolean
      video: boolean
      pdf: boolean
    }
    interleaved: boolean
  }
  cost: {
    input: number
    output: number
    cache: { read: number; write: number }
  }
  limit: {
    context: number
    output: number
  }
}

// Default Qwen Local configuration
// Note: baseURL is resolved at runtime to avoid context issues during module load
const getQwenLocalConfig = (): LocalProviderConfig => ({
  id: "qwen-local",
  name: "Qwen (Local)",
  baseURL: process.env.QWEN_LOCAL_URL || "http://127.0.0.1:8088/v1",
  models: {
    "qwen2.5-0.5b-instruct": {
      id: "qwen2.5-0.5b-instruct",
      name: "Qwen2.5 0.5B Instruct",
      providerID: "qwen-local",
      capabilities: {
        temperature: true,
        reasoning: false,
        attachment: false,
        toolcall: false,
        input: { text: true, audio: false, image: false, video: false, pdf: false },
        output: { text: true, audio: false, image: false, video: false, pdf: false },
        interleaved: false,
      },
      cost: {
        input: 0,
        output: 0,
        cache: { read: 0, write: 0 },
      },
      limit: {
        context: 4096,
        output: 4096,
      },
    },
  },
})

/**
 * Check if local Qwen service is available
 */
async function isQwenLocalAvailable(): Promise<boolean> {
  try {
    const config = getQwenLocalConfig()
    const response = await fetch(`${config.baseURL}/models`, {
      method: "GET",
      tls: { rejectUnauthorized: false },
    })
    return response.ok
  } catch (error) {
    log.debug("Qwen local service not available", { error: String(error) })
    return false
  }
}

/**
 * Create provider configuration for local AI
 */
function createLocalProvider(config: LocalProviderConfig) {
  return {
    id: config.id,
    name: config.name,
    source: "custom" as const,
    env: [],
    options: {
      baseURL: config.baseURL,
    },
    models: Object.fromEntries(
      Object.entries(config.models).map(([modelId, model]) => [
        modelId,
        {
          ...model,
          api: {
            id: modelId,
            url: config.baseURL,
            npm: "@ai-sdk/openai-compatible",
          },
          status: "active" as const,
          release_date: "2024-09-19",
          options: {},
          headers: {},
          variants: {},
        },
      ])
    ),
  }
}

export async function LocalAIPlugin(input: PluginInput): Promise<Hooks> {
  log.info("initializing local AI plugin")

  // Check if local services are available
  const qwenAvailable = await isQwenLocalAvailable()
  
  if (!qwenAvailable) {
    log.info("local AI services not available, skipping registration")
    return {}
  }

  log.info("local AI services available, registering providers")

  // Store providers for later use
  const localProviders: Record<string, ReturnType<typeof createLocalProvider>> = {}

  if (qwenAvailable) {
    localProviders["qwen-local"] = createLocalProvider(getQwenLocalConfig())
  }

  return {
    /**
     * Hook into provider loading to inject local providers
     */
    "chat.params": async (paramsInput, paramsOutput) => {
      // Check if using local provider
      if (paramsInput.provider?.info?.id?.includes("local")) {
        log.debug("using local AI provider", { provider: paramsInput.provider.info.id })
        
        // Adjust parameters for local models
        // Local models often work better with specific settings
        if (paramsOutput.temperature > 0.8) {
          paramsOutput.temperature = 0.7 // Cap temperature for stability
        }
      }
    },

    /**
     * Add custom headers for local providers
     */
    "chat.headers": async (headersInput, headersOutput) => {
      const providerId = headersInput.provider?.info?.id
      
      if (providerId?.includes("local")) {
        // Local providers might need special headers
        headersOutput.headers["X-Local-Provider"] = providerId
      }
    },
  }
}

/**
 * Get local provider definitions for injection into provider system
 * This function is called by provider.ts to get local provider definitions
 * Note: Uses process.env directly to avoid context issues
 */
export function getLocalProviderDefinitions(): Record<string, any> {
  const definitions: Record<string, any> = {}
  
  // Only add if environment variable is set
  // Note: Using process.env directly to avoid context initialization issues
  if (process.env.ENABLE_LOCAL_AI === "true" || process.env.QWEN_LOCAL_URL) {
    definitions["qwen-local"] = createLocalProvider(getQwenLocalConfig())
  }
  
  return definitions
}

/**
 * Check if local AI should be prioritized
 * Note: Uses process.env directly to avoid context issues
 */
export function shouldPrioritizeLocalAI(): boolean {
  return process.env.PRIORITIZE_LOCAL_AI === "true"
}

/**
 * Get the preferred local model
 * Note: Uses process.env directly to avoid context issues
 */
export function getPreferredLocalModel(): { providerId: string; modelId: string } | undefined {
  if (!shouldPrioritizeLocalAI()) return undefined
  
  // Check if qwen-local is available
  if (process.env.QWEN_LOCAL_URL || process.env.ENABLE_LOCAL_AI === "true") {
    return {
      providerId: "qwen-local",
      modelId: "qwen2.5-0.5b-instruct",
    }
  }
  
  return undefined
}
