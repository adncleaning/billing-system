"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import { LogOut, User } from "lucide-react"

interface SidebarItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface SidebarProps {
  items: SidebarItem[]
  title: string
}

export default function Sidebar({ items, title }: SidebarProps) {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const handleLogout = () => {
    logout()
    window.location.href = "/"
  }

  return (
    <div className="w-64 bg-white shadow-lg h-screen flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{user?.username}</h2>
            <p className="text-sm text-gray-500 capitalize">{user?.role}</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-6">
        <div className="px-3">
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
          <div className="space-y-1">
            {items.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className={`sidebar-item ${isActive ? "active" : ""}`}>
                  <span className="mr-3">{item.icon}</span>
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200">
        <button onClick={handleLogout} className="sidebar-item w-full text-red-600 hover:bg-red-50 hover:text-red-700">
          <LogOut className="h-5 w-5 mr-3" />
          Sign Out
        </button>
      </div>
    </div>
  )
}
