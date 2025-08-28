"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"

interface User {
  _id: string
  username: string
  fullName?: string
  email: string
  phone?: string
  type: "USER" | "ADMIN" | "CLEANER" | "DRIVER"
  userType: "ADN" | "OVEN" | "COMMERCIAL"
  verified: "VERIFIED" | "PENDING" | "SUSPENDED"
  // Mapeo para compatibilidad con el frontend
  id: string
  role: "admin" | "driver" | "client"
  clientData?: {
    fullName?: string
    email?: string
    phone?: string
    address?: string
    beneficiary?: {
      name?: string
      relationship?: string
      phone?: string
    }
  }
}

interface AuthContextType {
  user: User | null
  token: string | null
  login: (username: string, password: string) => Promise<boolean>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api.adncleaningservices.com/v1/api"

// Función API siguiendo tu estructura existente
function Api(method: string, url: string, data?: any, router?: any) {
  return new Promise((resolve, reject) => {
    let token = ""
    if (typeof window !== "undefined") {
      token = localStorage?.getItem("token") || ""
    }

    const headers: any = {
      "Content-Type": "application/json",
    }

    if (token) {
      headers.Authorization = `jwt ${token}`
    }

    fetch(`${API_URL}/${url}`, {
      method,
      headers,
      body: data ? JSON.stringify(data) : undefined,
    }).then(
      async (res) => {
        const responseData = await res.json()
        if (res.ok) {
          resolve(responseData)
        } else {
          if (res.status === 401) {
            if (typeof window !== "undefined") {
              localStorage.removeItem("token")
              localStorage.removeItem("user")
              if (router) {
                router.push("/")
              }
            }
          }
          reject(responseData)
        }
      },
      (err) => {
        console.log(err)
        reject(err)
      },
    )
  })
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const savedToken = localStorage.getItem("token")
    const savedUser = localStorage.getItem("user")

    if (savedToken && savedUser) {
      setToken(savedToken)
      setUser(JSON.parse(savedUser))
    }
    setLoading(false)
  }, [])

  const mapUserTypeToRole = (type: string): "admin" | "driver" | "client" => {
    switch (type) {
      case "ADMIN":
        return "admin"
      case "DRIVER":
        return "driver"
      case "CLEANER":
        return "driver"
      case "USER":
      default:
        return "client"
    }
  }

  const login = async (username: string, password: string): Promise<boolean> => {
    try {
      console.log("Attempting login with:", { username, password })

      const response: any = await Api("POST", "login", { username, password })

      console.log("Login response:", response)

      // Ajustar para la estructura de tu API
      if (response.status && response.data && response.data.token) {
        const userData = response.data

        // Mapear el usuario del backend al formato esperado por el frontend
        const mappedUser: User = {
          _id: userData._id,
          username: userData.fullName || userData.user || username, // Usar fullName o user como username
          fullName: userData.fullName,
          email: userData.email,
          phone: userData.phone,
          type: userData.type,
          userType: userData.userType,
          verified: userData.verified,
          id: userData._id,
          role: mapUserTypeToRole(userData.type),
          clientData:
            userData.type === "USER"
              ? {
                  fullName: userData.fullName,
                  email: userData.email,
                  phone: userData.phone,
                  address: userData.address,
                  beneficiary: {
                    name: "",
                    relationship: "",
                    phone: "",
                  },
                }
              : undefined,
        }

        console.log("Mapped user:", mappedUser)
        console.log("Token:", userData.token)

        setToken(userData.token)
        setUser(mappedUser)
        localStorage.setItem("token", userData.token)
        localStorage.setItem("user", JSON.stringify(mappedUser))

        return true
      } else {
        console.error("Login failed - invalid response structure:", response)
        return false
      }
    } catch (error) {
      console.error("Login error:", error)
      return false
    }
  }

  const logout = () => {
    setUser(null)
    setToken(null)
    localStorage.removeItem("token")
    localStorage.removeItem("user")
  }

  return <AuthContext.Provider value={{ user, token, login, logout, loading }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
//funcionalidad igual a la de back office
// Exportar la función Api para usar en otros componentes
export { Api }
