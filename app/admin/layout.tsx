"use client"

import type React from "react"
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import LoadingSpinner from "@/components/LoadingSpinner"
import { Users, FileText, DollarSign, BarChart3 } from "lucide-react"

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "admin")) {
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

  if (!user || user.role !== "admin") {
    return null
  }

  const sidebarItems = [
    {
      href: "/admin",
      label: "Dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      href: "/admin/clients",
      label: "Clients",
      icon: <Users className="h-5 w-5" />,
    },
    {
      href: "/admin/invoices",
      label: "Invoices",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      href: "/admin/tariffs",
      label: "Tariffs",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      href: "/admin/guides",
      label: "Guides",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      href: "/admin/payments",
      label: "Driver Payments",
      icon: <DollarSign className="h-5 w-5" />,
    },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={sidebarItems} title="Administration" />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
