"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { Users, FileText, DollarSign, TrendingUp } from "lucide-react"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.com/v1/api"

interface DashboardStats {
  totalClients: number
  activeInvoices: number
  totalCollected: number
  monthlyGrowth: number
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    totalClients: 0,
    activeInvoices: 0,
    totalCollected: 0,
    monthlyGrowth: 0,
  })
  const [loading, setLoading] = useState(true)
  const { token } = useAuth()

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Demo data instead of API calls
        await new Promise((resolve) => setTimeout(resolve, 500)) // Simulate loading

        setStats({
          totalClients: 15,
          activeInvoices: 8,
          totalCollected: 12500,
          monthlyGrowth: 12,
        })
      } catch (error) {
        console.error("Error fetching stats:", error)
      } finally {
        setLoading(false)
      }
    }

    if (token) {
      fetchStats()
    }
  }, [token])

  const statCards = [
    {
      title: "Total Clients",
      value: stats.totalClients,
      icon: <Users className="h-8 w-8 text-blue-600" />,
      description: "Registered clients",
      color: "blue",
    },
    {
      title: "Active Invoices",
      value: stats.activeInvoices,
      icon: <FileText className="h-8 w-8 text-green-600" />,
      description: "Pending invoices",
      color: "green",
    },
    {
      title: "Total Collected",
      value: `$${stats.totalCollected.toLocaleString()}`,
      icon: <DollarSign className="h-8 w-8 text-purple-600" />,
      description: "This month",
      color: "purple",
    },
    {
      title: "Growth",
      value: `+${stats.monthlyGrowth}%`,
      icon: <TrendingUp className="h-8 w-8 text-orange-600" />,
      description: "From last month",
      color: "orange",
    },
  ]

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome to the billing management system</p>
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

      {/* Quick Actions & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <Users className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-700">Create new client</span>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <FileText className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-700">Generate invoice</span>
            </div>
            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
              <DollarSign className="h-5 w-5 text-gray-600 mr-3" />
              <span className="text-sm text-gray-700">Review pending payments</span>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="text-sm text-gray-500 text-center py-8">No recent activity</div>
          </div>
        </div>
      </div>
    </div>
  )
}
