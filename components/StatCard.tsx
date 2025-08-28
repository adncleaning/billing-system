import type React from "react"
interface StatCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  description: string
  color?: "blue" | "green" | "purple" | "orange" | "red"
  loading?: boolean
}

export default function StatCard({ title, value, icon, description, color = "blue", loading = false }: StatCardProps) {
  const colorClasses = {
    blue: "text-blue-600",
    green: "text-green-600",
    purple: "text-purple-600",
    orange: "text-orange-600",
    red: "text-red-600",
  }

  return (
    <div className="card p-6 animate-bounce-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-2">{loading ? "..." : value}</p>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
        <div className={`flex-shrink-0 ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  )
}
