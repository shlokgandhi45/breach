# BREACH — AI Recruitment Platform

A production-grade multi-page SaaS recruitment dashboard built with Next.js 14, Tailwind CSS, and React.

## Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Font**: DM Sans + DM Mono (Google Fonts)

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## Pages

| Route | Description |
|---|---|
| `/dashboard` | Recruiter overview with stats, pipeline flow, AI recommendations |
| `/candidates` | Candidate database — table + card views with filters |
| `/candidate-profile?id=1` | Full candidate profile with tabs, timeline, notes |
| `/compare` | Side-by-side candidate comparison table |
| `/pipeline` | Drag-and-drop Kanban pipeline board |
| `/referrals` | Employee referral submission form |
| `/settings` | Profile, notifications, AI config, team, security |

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── dashboard/
│   ├── candidates/
│   ├── candidate-profile/
│   ├── compare/
│   ├── pipeline/
│   ├── referrals/
│   └── settings/
├── components/
│   ├── layout/             # AppShell, Sidebar, Topbar
│   ├── ui/                 # Avatar, MatchScore, StatusBadge, SkillTag
│   ├── dashboard/          # StatCards, PipelineFlow, AIRecommendations, UpcomingInterviews
│   ├── candidates/         # CandidateRow, CandidateCard, FilterBar
│   └── pipeline/           # KanbanColumn, KanbanCard
├── data/
│   └── candidates.js       # Mock candidate data
└── lib/
    └── utils.js            # Helper functions
```

## Design System

- **Background**: `#F8F9FB`
- **Card**: `#FFFFFF`  
- **Primary**: `#2563EB`
- **Text**: `#111827`
- **Secondary text**: `#6B7280`
- **Font**: DM Sans (body), DM Mono (numbers/scores)
