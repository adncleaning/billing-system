"use client"

import type React from "react"

import { useState } from "react"
import { Search, X } from "lucide-react"

interface SearchInputProps {
  placeholder?: string
  onSearch: (query: string) => void
  className?: string
}

export default function SearchInput({ placeholder = "Search...", onSearch, className = "" }: SearchInputProps) {
  const [query, setQuery] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSearch(query)
  }

  const handleClear = () => {
    setQuery("")
    onSearch("")
  }

  return (
    <form onSubmit={handleSubmit} className={`relative ${className}`}>
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        <Search className="h-5 w-5 text-gray-400" />
      </div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input pl-10 pr-10"
        placeholder={placeholder}
      />
      {query && (
        <button type="button" onClick={handleClear} className="absolute inset-y-0 right-0 pr-3 flex items-center">
          <X className="h-5 w-5 text-gray-400 hover:text-gray-600" />
        </button>
      )}
    </form>
  )
}
