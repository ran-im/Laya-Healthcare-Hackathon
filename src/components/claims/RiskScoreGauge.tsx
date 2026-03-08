'use client'

import { motion } from 'framer-motion'

interface RiskScoreGaugeProps {
  score: number
  label?: string
}

export function RiskScoreGauge({ score, label = 'Risk Score' }: RiskScoreGaugeProps) {
  const getColor = (value: number) => {
    if (value < 30) return '#22c55e'
    if (value < 60) return '#eab308'
    return '#ef4444'
  }

  const getRiskLevel = (value: number) => {
    if (value < 30) return 'Low Risk'
    if (value < 60) return 'Medium Risk'
    return 'High Risk'
  }

  const color = getColor(score)
  const riskLevel = getRiskLevel(score)
  const circumference = 2 * Math.PI * 45
  const strokeDashoffset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="45"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
          />
          <motion.circle
            cx="64"
            cy="64"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-2xl font-bold"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <div className="mt-2 text-center">
        <p className="font-medium" style={{ color }}>{riskLevel}</p>
        {label && <p className="text-sm text-gray-500">{label}</p>}
      </div>
    </div>
  )
}
