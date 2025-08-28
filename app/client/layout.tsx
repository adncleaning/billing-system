"use client"

import type React from "react"
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import LoadingSpinner from "@/components/LoadingSpinner"
import { User, Users, Settings } from "lucide-react"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "client")) {
      router.push("/")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (!user || user.role !== "client") {
    return null
  }

  const sidebarItems = [
    {
      href: "/client",
      label: "Profile",
      icon: <User className="h-5 w-5" />,
    },
    {
      href: "/client/beneficiary",
      label: "Beneficiary",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/client/settings",
      label: "Settings",
      icon: <Settings className="h-5 w-5" />,
    },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={sidebarItems} title="Client Portal" />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
