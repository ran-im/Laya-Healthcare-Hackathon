import { create } from 'zustand'
import type { Claim } from '@/types'

interface ClaimState {
  claims: Claim[]
  currentClaim: Claim | null
  isLoading: boolean
  setClaims: (claims: Claim[]) => void
  setCurrentClaim: (claim: Claim | null) => void
  addClaim: (claim: Claim) => void
  updateClaim: (id: string, updates: Partial<Claim>) => void
  setLoading: (isLoading: boolean) => void
}

export const useClaimStore = create<ClaimState>((set) => ({
  claims: [],
  currentClaim: null,
  isLoading: false,
  setClaims: (claims) => set({ claims }),
  setCurrentClaim: (claim) => set({ currentClaim: claim }),
  addClaim: (claim) => set((state) => ({ claims: [claim, ...state.claims] })),
  updateClaim: (id, updates) => set((state) => ({
    claims: state.claims.map((c) => c.id === id ? { ...c, ...updates } : c)
  })),
  setLoading: (isLoading) => set({ isLoading }),
}))
