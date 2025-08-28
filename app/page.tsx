"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/contexts/AuthContext"
import LoginForm from "@/components/LoginForm"
import LoadingSpinner from "@/components/LoadingSpinner"

export default function Home() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      switch (user.role) {
        case "admin":
          router.push("/admin")
          break
        case "driver":
          router.push("/driver")
          break
        case "client":
          router.push("/client")
          break
      }
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="large" />
      </div>
    )
  }

  if (user) {
    return null // Redirecting...
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">ADN Cleaning Services</h1>
          <p className="text-gray-600">Billing Management System</p>
        </div>
        <LoginForm />
      </div>
    </div>
  )
}
