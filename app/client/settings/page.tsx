"use client"

import type React from "react"
import { useState } from "react"
import { useAuth } from "@/contexts/AuthContext"
import { useToast } from "@/contexts/ToastContext"
import { Lock, Bell, Shield, Eye, EyeOff, Save } from "lucide-react"

export default function ClientSettingsPage() {
  const { user, logout } = useAuth()
  const { showToast } = useToast()
  const [loading, setLoading] = useState(false)
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  })

  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    smsNotifications: false,
    invoiceReminders: true,
    paymentConfirmations: true,
  })

  const [privacySettings, setPrivacySettings] = useState({
    shareDataWithPartners: false,
    allowMarketing: false,
    twoFactorAuth: false,
  })

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      showToast("New passwords do not match", "error")
      return
    }

    if (passwordData.newPassword.length < 6) {
      showToast("Password must be at least 6 characters long", "error")
      return
    }

    setLoading(true)

    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call

      showToast("Password updated successfully", "success")
      setPasswordData({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      })
    } catch (error) {
      showToast("Error updating password", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleNotificationUpdate = async () => {
    setLoading(true)
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
      showToast("Notification settings updated", "success")
    } catch (error) {
      showToast("Error updating settings", "error")
    } finally {
      setLoading(false)
    }
  }

  const handlePrivacyUpdate = async () => {
    setLoading(true)
    try {
      // API call would go here
      await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
      showToast("Privacy settings updated", "success")
    } catch (error) {
      showToast("Error updating settings", "error")
    } finally {
      setLoading(false)
    }
  }

  const handleAccountDeactivation = async () => {
    if (window.confirm("Are you sure you want to deactivate your account? This action cannot be undone.")) {
      setLoading(true)
      try {
        // API call would go here
        await new Promise((resolve) => setTimeout(resolve, 1000)) // Simulate API call
        showToast("Account deactivated successfully", "success")
        logout()
      } catch (error) {
        showToast("Error deactivating account", "error")
      } finally {
        setLoading(false)
      }
    }
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account preferences and security settings</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Settings Navigation */}
        <div className="lg:col-span-1">
          <div className="card p-4">
            <nav className="space-y-2">
              <a href="#password" className="flex items-center p-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Lock className="h-5 w-5 mr-3" />
                Password & Security
              </a>
              <a href="#notifications" className="flex items-center p-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Bell className="h-5 w-5 mr-3" />
                Notifications
              </a>
              <a href="#privacy" className="flex items-center p-3 text-gray-700 hover:bg-gray-100 rounded-lg">
                <Shield className="h-5 w-5 mr-3" />
                Privacy
              </a>
            </nav>
          </div>
        </div>

        {/* Settings Content */}
        <div className="lg:col-span-2 space-y-8">
          {/* Password & Security */}
          <div id="password" className="card p-6">
            <div className="flex items-center mb-6">
              <Lock className="h-6 w-6 text-gray-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Password & Security</h2>
            </div>

            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? "text" : "password"}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="input pr-10"
                    required
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5 text-gray-400" />
                    ) : (
                      <Eye className="h-5 w-5 text-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end">
                <button type="submit" disabled={loading} className="btn-primary flex items-center">
                  <Save className="h-4 w-4 mr-2" />
                  {loading ? "Updating..." : "Update Password"}
                </button>
              </div>
            </form>
          </div>

          {/* Notifications */}
          <div id="notifications" className="card p-6">
            <div className="flex items-center mb-6">
              <Bell className="h-6 w-6 text-gray-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Notification Preferences</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Email Notifications</h3>
                  <p className="text-sm text-gray-500">Receive notifications via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        emailNotifications: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">SMS Notifications</h3>
                  <p className="text-sm text-gray-500">Receive notifications via text message</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.smsNotifications}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        smsNotifications: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Invoice Reminders</h3>
                  <p className="text-sm text-gray-500">Get reminded about upcoming invoice due dates</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.invoiceReminders}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        invoiceReminders: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Payment Confirmations</h3>
                  <p className="text-sm text-gray-500">Receive confirmations when payments are processed</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.paymentConfirmations}
                    onChange={(e) =>
                      setNotificationSettings({
                        ...notificationSettings,
                        paymentConfirmations: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={handleNotificationUpdate} disabled={loading} className="btn-primary flex items-center">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Preferences"}
              </button>
            </div>
          </div>

          {/* Privacy */}
          <div id="privacy" className="card p-6">
            <div className="flex items-center mb-6">
              <Shield className="h-6 w-6 text-gray-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">Privacy Settings</h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Share Data with Partners</h3>
                  <p className="text-sm text-gray-500">Allow sharing of anonymized data with trusted partners</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacySettings.shareDataWithPartners}
                    onChange={(e) =>
                      setPrivacySettings({
                        ...privacySettings,
                        shareDataWithPartners: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Marketing Communications</h3>
                  <p className="text-sm text-gray-500">Receive promotional emails and offers</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacySettings.allowMarketing}
                    onChange={(e) =>
                      setPrivacySettings({
                        ...privacySettings,
                        allowMarketing: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-medium text-gray-900">Two-Factor Authentication</h3>
                  <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacySettings.twoFactorAuth}
                    onChange={(e) =>
                      setPrivacySettings({
                        ...privacySettings,
                        twoFactorAuth: e.target.checked,
                      })
                    }
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            <div className="flex justify-end mt-6">
              <button onClick={handlePrivacyUpdate} disabled={loading} className="btn-primary flex items-center">
                <Save className="h-4 w-4 mr-2" />
                {loading ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="card p-6 border-red-200 bg-red-50">
            <div className="flex items-center mb-6">
              <Shield className="h-6 w-6 text-red-600 mr-3" />
              <h2 className="text-xl font-semibold text-red-900">Danger Zone</h2>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-red-900">Deactivate Account</h3>
                <p className="text-sm text-red-700 mb-4">
                  Once you deactivate your account, there is no going back. Please be certain.
                </p>
                <button onClick={handleAccountDeactivation} disabled={loading} className="btn-danger">
                  {loading ? "Deactivating..." : "Deactivate Account"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
