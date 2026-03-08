import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
export function formatCurrency(amount: number, currency = 'EUR') {
  return new Intl.NumberFormat('en-IE', { style: 'currency', currency }).format(amount)
}
export function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-IE', { day: 'numeric', month: 'long', year: 'numeric' })
}
export function generateClaimId() {
  const year = new Date().getFullYear()
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0')
  return `CLM-${year}-${random}`
}
export function getStatusColor(status: string) {
  const colors: Record<string, string> = {
    'Submitted': 'bg-blue-100 text-blue-800 border-blue-200',
    'In Review': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'Approved': 'bg-green-100 text-green-800 border-green-200',
    'Paid': 'bg-teal-100 text-teal-800 border-teal-200',
    'Rejected': 'bg-red-100 text-red-800 border-red-200',
    'Info Required': 'bg-orange-100 text-orange-800 border-orange-200',
  }
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200'
}
export function getRiskLevel(score: number): { label: string; color: string } {
  if (score < 0.3) return { label: 'Low', color: 'text-green-600' }
  if (score < 0.7) return { label: 'Medium', color: 'text-yellow-600' }
  return { label: 'High', color: 'text-red-600' }
}
