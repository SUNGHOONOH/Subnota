import { Button } from "@/components/tiptap-ui-primitive/button"

// --- Icons ---
import { MoonStarIcon } from "@/components/tiptap-icons/moon-star-icon"
import { SunIcon } from "@/components/tiptap-icons/sun-icon"
import { useEffect, useState } from "react"

const THEME_STORAGE_KEY = "subnota.theme"

const readStoredTheme = (): "dark" | "light" | null => {
  if (typeof window === "undefined" || !window.localStorage) return null
  const value = window.localStorage.getItem(THEME_STORAGE_KEY)
  return value === "dark" || value === "light" ? value : null
}

const getInitialDarkMode = () => {
  const stored = readStoredTheme()
  if (stored) return stored === "dark"
  return window.matchMedia("(prefers-color-scheme: dark)").matches
}

export function ThemeToggle({ className }: { className?: string }) {
  const [isDarkMode, setIsDarkMode] = useState<boolean>(getInitialDarkMode)

  // Follow the OS theme only while the user hasn't picked an explicit one.
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      if (!readStoredTheme()) setIsDarkMode(mediaQuery.matches)
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  // Apply + persist the chosen theme.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDarkMode)
  }, [isDarkMode])

  const toggleDarkMode = () =>
    setIsDarkMode((isDark) => {
      const next = !isDark
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(THEME_STORAGE_KEY, next ? "dark" : "light")
      }
      return next
    })

  return (
    <Button
      className={className}
      onClick={toggleDarkMode}
      aria-label={`Switch to ${isDarkMode ? "light" : "dark"} mode`}
      variant="ghost"
    >
      {isDarkMode ? (
        <MoonStarIcon className="tiptap-button-icon" />
      ) : (
        <SunIcon className="tiptap-button-icon" />
      )}
    </Button>
  )
}
