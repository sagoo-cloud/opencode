import { Component, createSignal, onMount, createEffect, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Button } from "@opencode-ai/ui/button"
import { Switch } from "@opencode-ai/ui/switch"
import { showToast } from "@opencode-ai/ui/toast"
import { useLanguage } from "@/context/language"
import { useSettings } from "@/context/settings"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"

interface LocalModelStatus {
  exists: boolean
  size: number
  path: string
}

export const SettingsLocalAI: Component = () => {
  const language = useLanguage()
  const settings = useSettings()
  
  const [status, setStatus] = createSignal<LocalModelStatus | null>(null)
  const [downloading, setDownloading] = createSignal(false)
  const [progress, setProgress] = createSignal(0)
  const [serverStatus, setServerStatus] = createSignal<"stopped" | "running">("stopped")

  const refreshStatus = async () => {
    try {
      const res = await invoke<LocalModelStatus>("check_local_model")
      setStatus(res)
      
      // If enabled and model exists, try to start server if not running
      // But for status check, we might need another command or just rely on success
      if (settings.localAI.enabled() && res.exists) {
         startServer()
      } else {
         stopServer()
      }
    } catch (e) {
      console.error(e)
    }
  }

  const startServer = async () => {
    try {
      await invoke("start_local_server")
      setServerStatus("running")
    } catch (e) {
      console.error("Failed to start server", e)
      setServerStatus("stopped")
    }
  }

  const stopServer = async () => {
    try {
      await invoke("stop_local_server")
      setServerStatus("stopped")
    } catch (e) {
      console.error(e)
    }
  }

  const downloadModel = async () => {
    setDownloading(true)
    setProgress(0)
    try {
      await invoke("download_local_model")
      showToast({
        title: "Download Complete",
        description: "Local model has been downloaded successfully.",
        variant: "success"
      })
      await refreshStatus()
    } catch (e) {
      showToast({
        title: "Download Failed",
        description: String(e),
        variant: "error"
      })
    } finally {
      setDownloading(false)
    }
  }

  onMount(async () => {
    await refreshStatus()
    
    const unlisten = await listen<[number, number]>("model-download-progress", (event) => {
      const [current, total] = event.payload
      if (total > 0) {
        setProgress(Math.round((current / total) * 100))
      }
    })

    return () => {
      unlisten()
    }
  })

  // React to toggle changes
  createEffect(() => {
    const enabled = settings.localAI.enabled()
    if (enabled) {
      if (status()?.exists) {
        startServer()
      }
    } else {
      stopServer()
    }
  })

  return (
    <div class="flex flex-col h-full overflow-y-auto no-scrollbar px-4 pb-10 sm:px-10 sm:pb-10">
      <div class="sticky top-0 z-10 bg-[linear-gradient(to_bottom,var(--surface-raised-stronger-non-alpha)_calc(100%_-_24px),transparent)]">
        <div class="flex flex-col gap-1 pt-6 pb-8">
          <h2 class="text-16-medium text-text-strong">Local AI</h2>
        </div>
      </div>

      <div class="flex flex-col gap-8 w-full">
        <div class="flex flex-col gap-1">
          <h3 class="text-14-medium text-text-strong pb-2">Configuration</h3>

          <div class="bg-surface-raised-base px-4 rounded-lg">
            <SettingsRow
              title="Enable Local AI"
              description="Use local Qwen2.5-0.5B model for background tasks (Zero Cost)"
            >
              <Switch
                checked={settings.localAI.enabled()}
                onChange={(checked) => settings.localAI.setEnabled(checked)}
              />
            </SettingsRow>

            <SettingsRow
              title="Model Status"
              description={status()?.exists 
                ? `Installed (${(status()!.size / 1024 / 1024).toFixed(1)} MB)` 
                : "Not Installed"}
            >
              {status()?.exists ? (
                 <span class="text-text-success text-12-medium">Ready</span>
              ) : (
                 <Button 
                   size="small" 
                   variant="secondary" 
                   onClick={downloadModel}
                   disabled={downloading()}
                 >
                   {downloading() ? `Downloading ${progress()}%` : "Download Model"}
                 </Button>
              )}
            </SettingsRow>
            
            {status()?.exists && (
               <SettingsRow
                 title="Server Status"
                 description={serverStatus() === "running" ? "Running on port 8088" : "Stopped"}
               >
                 <div class={`w-2 h-2 rounded-full ${serverStatus() === "running" ? "bg-green-500" : "bg-red-500"}`} />
               </SettingsRow>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

interface SettingsRowProps {
  title: string
  description: string | JSX.Element
  children: JSX.Element
}

const SettingsRow: Component<SettingsRowProps> = (props) => {
  return (
    <div class="flex flex-wrap items-center justify-between gap-4 py-3 border-b border-border-weak-base last:border-none">
      <div class="flex flex-col gap-0.5 min-w-0">
        <span class="text-14-medium text-text-strong">{props.title}</span>
        <span class="text-12-regular text-text-weak">{props.description}</span>
      </div>
      <div class="flex-shrink-0">{props.children}</div>
    </div>
  )
}
