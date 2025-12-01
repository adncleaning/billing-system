"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { FileText, DollarSign, Clock, CheckCircle, Calculator } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.co.uk/v1/api/"

interface DriverStats {
  assignedInvoices: number
  pendingPayments: number
  collectedToday: number
  totalCollected: number
}

export default function DriverDashboard() {
  const [stats, setStats] = useState<DriverStats>({
    assignedInvoices: 0,
    pendingPayments: 0,
    collectedToday: 0,
    totalCollected: 0,
  })
  const [loading, setLoading] = useState(true)
  const { user, token } = useAuth()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Demo data instead of API calls
        await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate loading

        setStats({
          assignedInvoices: 12,
          pendingPayments: 5,
          collectedToday: 850.0,
          totalCollected: 15420.5,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    if (token && user) {
      fetchStats()
    }
  }, [token, user])

  const statCards = [
    {
      title: "Assigned Invoices",
      value: stats.assignedInvoices,
      icon: <FileText className="h-8 w-8 text-blue-600" />,
      description: "Total assigned to you",
      color: "blue",
    },
    {
      title: "Pending Payments",
      value: stats.pendingPayments,
      icon: <Clock className="h-8 w-8 text-orange-600" />,
      description: "Awaiting collection",
      color: "orange",
    },
    {
      title: "Collected Today",
      value: `$${stats.collectedToday.toFixed(2)}`,
      icon: <DollarSign className="h-8 w-8 text-green-600" />,
      description: "Today's collections",
      color: "green",
    },
    {
      title: "Total Collected",
      value: `$${stats.totalCollected.toFixed(2)}`,
      icon: <CheckCircle className="h-8 w-8 text-purple-600" />,
      description: "All time collections",
      color: "purple",
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Driver Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back, {user?.username}!</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, index) => (
          <div key={stat.title} className="card p-6 animate-bounce-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{loading ? "..." : stat.value}</p>
                <p className="text-xs text-gray-500 mt-1">{stat.description}</p>
              </div>
              <div className="flex-shrink-0">{stat.icon}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-700">View assigned invoices</span>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-700">Record new payment</span>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Calculator className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-700">Create cash closure</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Summary</h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Collections Made:</span>
              <span className="font-medium">{loading ? "..." : "0"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Amount Collected:</span>
              <span className="font-medium">${stats.collectedToday.toFixed(2)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Pending Collections:</span>
              <span className="font-medium">{stats.pendingPayments}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
