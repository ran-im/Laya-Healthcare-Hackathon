# 🏥 Laya Healthcare AI Claims Portal

> **Hackathon Project** — An AI-powered healthcare insurance claims management system built for Laya Healthcare (part of AXA Group), Ireland.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-green?style=flat-square&logo=supabase)
![Claude AI](https://img.shields.io/badge/Claude-Haiku-orange?style=flat-square)
![Vercel](https://img.shields.io/badge/Deployed-Vercel-black?style=flat-square&logo=vercel)

---

## 🎯 What This Does

This portal replaces the traditional paper-based and manual insurance claims process with an intelligent, AI-assisted system. Members submit claims digitally, and AI automatically assesses fraud risk, complexity, and recommends approve/reject decisions to human assessors.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| 🔐 **Multi-role Auth** | Member, Assessor, Admin, Fraud roles with separate dashboards |
| 📋 **Claims Wizard** | 4-step guided claim submission with document upload |
| 🤖 **AI Assessment** | Claude AI analyzes claims for fraud, complexity & recommends decisions |
| 💬 **AI Chat** | Assessors can ask Claude contextual questions about any claim |
| 📊 **Analytics** | Admin dashboard with real-time claims intelligence |
| ✅ **Benefit Check** | Members can check coverage + ask AI about treatments |

---

## 🗂️ Project Structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx          # Login with demo credentials
│   │   └── register/page.tsx       # New member registration
│   ├── (member)/
│   │   ├── dashboard/page.tsx      # Member home — stats & recent claims
│   │   ├── claims/page.tsx         # Full claims list with search/filter
│   │   ├── claims/[id]/page.tsx    # Claim detail — timeline & documents
│   │   ├── submit-claim/page.tsx   # 4-step claim submission wizard
│   │   └── benefit-check/page.tsx  # Coverage lookup + AI benefit advisor
│   ├── (assessor)/
│   │   ├── assessor-dashboard/page.tsx  # Claims review queue with AI scores
│   │   └── review/[id]/page.tsx         # AI review panel + decision workflow
│   ├── (admin)/
│   │   └── analytics/page.tsx      # Admin analytics dashboard
│   └── api/
│       ├── ai/summarize/route.ts   # Claude claim analysis endpoint
│       ├── ai/chat/route.ts        # Claude contextual Q&A endpoint
│       ├── ai/benefit-check/route.ts # Claude benefit advisor endpoint
│       └── auth/demo-setup/route.ts  # Demo user seeding
├── middleware.ts                   # Role-based route protection
└── lib/supabase/                   # Supabase client/server helpers
```

---

## 👥 Demo Accounts

| Role | Email | Password | Access |
|---|---|---|---|
| **Member** | member@laya-demo.com | Demo1234! | Dashboard, Claims, Submit, Benefit Check |
| **Assessor** | assessor@laya-demo.com | Demo1234! | Claims queue, AI Review Panel |
| **Admin** | admin@laya-demo.com | Demo1234! | Analytics dashboard |
| **Fraud** | fraud@laya-demo.com | Demo1234! | Fraud review queue |

---

## 🧭 How to Navigate the App

### As a Member (Sarah Murphy)
1. **Login** → `member@laya-demo.com / Demo1234!`
2. **Dashboard** → See your 5 demo claims, stats (Total, Pending, Approved, Paid)
3. **My Claims** → Click any claim to see full details, status timeline
4. **Submit Claim** → 4-step wizard: Type → Details → Documents → Review
5. **Benefit Check** → Search treatments or ask AI "Is physio covered?"

### As an Assessor (James)
1. **Login** → `assessor@laya-demo.com / Demo1234!`
2. **Assessor Dashboard** → See all claims queue with AI Fraud/Complexity score bars
3. **Click "Review"** on any claim → Opens AI Review Panel
4. **Click "Analyze Claim"** → Claude AI gives full professional assessment
5. **AI Chat** → Ask "Should I approve this?" or "What documents are missing?"
6. **Issue Decision** → Click Approve / Reject / Request Info

### As Admin
1. **Login** → `admin@laya-demo.com / Demo1234!`
2. **Analytics** → View claims by type, status breakdown, AI efficiency stats

---

## 🤖 AI Architecture

```
Member submits claim
        ↓
Assessor clicks "Analyze Claim"
        ↓
POST /api/ai/summarize
        ↓
Claude Haiku reads full claim context
        ↓
Returns: Summary + Risk Level + Recommendation
        ↓
Scores saved to DB (fraud_score, complexity_score, anomaly_score)
        ↓
Assessor chats with Claude via /api/ai/chat
        ↓
Assessor issues decision → DB updated → Member notified
```

**AI Scoring Logic:**
- **Fraud Score**: No pre-auth + high amount, missing docs, foreign treatment
- **Complexity Score**: Inpatient type, admission/discharge dates, high amount  
- **Routing**: fraud≥60% → fraud queue | fraud<25% & complex<30% → auto-approve | else → manual review

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | Next.js 14 (App Router), TypeScript, inline styles |
| **Auth** | Supabase Auth with RLS policies |
| **Database** | Supabase PostgreSQL |
| **AI** | Anthropic Claude Haiku (`claude-haiku-4-5-20251001`) |
| **Storage** | Supabase Storage (claim documents) |
| **Deployment** | Vercel |

---

## 🚀 Local Setup

```bash
# Clone
git clone https://github.com/ran-im/Laya-Healthcare-Hackathon
cd Laya-Healthcare-Hackathon

# Install
npm install

# Environment — create .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ANTHROPIC_API_KEY=your_anthropic_key

# Seed demo users
curl http://localhost:3000/api/auth/demo-setup

# Run
npm run dev
```

---

## 🗄️ Database Schema

Key tables in Supabase:

- **`profiles`** — User profiles with role, plan, member_id
- **`claims`** — Core claims data with AI scores (fraud_score, complexity_score, anomaly_score, routing)
- **`claim_documents`** — Uploaded files linked to claims
- **`claim_messages`** — Thread between member and assessor
- **`notifications`** — System notifications per user
- **`plan_benefits`** — Coverage data per plan

---

## 🎨 Design System

| Token | Value | Usage |
|---|---|---|
| `laya-dark` | `#003C3A` | Primary brand, headers |
| `laya-mid` | `#005C58` | Secondary elements |
| `laya-teal` | `#00A89D` | CTAs, links, accents |
| `laya-accent` | `#00D4C8` | Highlights |
| `laya-warm` | `#F2FAF9` | Background tint |
| `laya-gold` | `#E8A020` | Warnings, pending |
| `laya-rose` | `#E8505B` | Errors, rejected |

---

## 👨‍💻 Team

Built at NCI Dublin Hackathon 2026

---

## 📄 License

MIT — built for educational/hackathon purposes. Not for production medical use.
