"use client"

import { useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"

export default function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, loading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!loading && !token) {
      // Guarda a dónde quería ir para volver tras login
      const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : ""
      router.replace(`/${next}`)
    }
  }, [loading, token, router, pathname])

  if (loading) return null          // o un spinner si quieres
  if (!token) return null           // evita pintar layout antes de redirigir

  return <>{children}</>
}
