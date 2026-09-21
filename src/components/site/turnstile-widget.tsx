"use client"

// Rendered only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is set; the server verifies only when TURNSTILE_SECRET_KEY is set (both must be enabled together).
import { useEffect, useRef, useState } from "react"

export function TurnstileWidget({ onToken }: { onToken: (token: string | null) => void }) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  const [token, setToken] = useState<string | null>(null)
  const cbRef = useRef(onToken)
  cbRef.current = onToken

  useEffect(() => {
    if (!siteKey) return
    const callback = (t: string) => {
      setToken(t)
      cbRef.current(t)
    }
    ;(window as unknown as Record<string, unknown>).__onTurnstileSuccess = callback
    const s = document.createElement("script")
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js"
    s.async = true
    document.head.appendChild(s)
    return () => {
      s.remove()
      delete (window as unknown as Record<string, unknown>).__onTurnstileSuccess
    }
  }, [siteKey])

  if (!siteKey) return null
  return (
    <div
      className="cf-turnstile"
      data-sitekey={siteKey}
      data-callback="__onTurnstileSuccess"
      data-theme="dark"
      data-hidden={token ? "true" : undefined}
    />
  )
}
