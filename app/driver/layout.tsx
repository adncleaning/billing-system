"use client"

import type React from "react"
import { useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useRouter } from "next/navigation"
import Sidebar from "@/components/Sidebar"
import LoadingSpinner from "@/components/LoadingSpinner"
import { FileText, DollarSign, Calculator, BarChart3 } from "lucide-react"

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && (!user || user.role !== "driver")) {
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

  if (!user || user.role !== "driver") {
    return null
  }

  const sidebarItems = [
    {
      href: "/driver",
      label: "Dashboard",
      icon: <BarChart3 className="h-5 w-5" />,
    },
    {
      href: "/driver/invoices",
      label: "Invoices",
      icon: <FileText className="h-5 w-5" />,
    },
    {
      href: "/driver/payments",
      label: "Record Payment",
      icon: <DollarSign className="h-5 w-5" />,
    },
    {
      href: "/driver/cash-closure",
      label: "Cash Closure",
      icon: <Calculator className="h-5 w-5" />,
    },
  ]

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar items={sidebarItems} title="Driver Panel" />
      <main className="flex-1 p-8 overflow-auto">{children}</main>
    </div>
  )
}
