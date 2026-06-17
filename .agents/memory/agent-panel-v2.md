---
name: Agent Panel V2 architecture
description: 5-tab mobile-first collection workflow for agents; shared CollectDialog component location and exports; what was removed vs kept.
---

## Structure
AgentDashboard.tsx → 5 tabs: today / customers / collections / history / profile
- Bottom nav (mobile) + sidebar (desktop), no role-switch toggle, no admin/collector mode

## Shared CollectDialog
- Lives at `components/agent/CollectDialog.tsx` (root-level, NOT `src/components/agent/`)
- Exports: `default CollectDialog`, `TYPE_BADGE`, `TYPE_LABEL`, `getCustomerType`, `toDate`
- Handles SAVINGS / LOAN / COMBINED modes; loads account details on open via services
- All pages import: `import CollectDialog, { ... } from "@/components/agent/CollectDialog"`

## Pages (all in src/pages/agent/)
- **AgentOverview.tsx** (Today): 4 KPI cards (Today's ₹, Pending, Assigned, EMI Due), customer route list, no search, Collect+View quick actions, accepts `onSwitchTab` prop
- **AgentCustomers.tsx** (Customers): All/Savings/Loan/S+L filter tabs, expandable inline cards, savings+loan balance display, no creation, no search
- **AgentCollections.tsx** (Collections): All/Savings/EMI/Pending sub-tabs, S+L customers show 3 split buttons (Savings/EMI/Both)
- **AgentHistory.tsx** (History): Date-wise groups (Today/Yesterday/Older), type filter (All/Savings/EMI/Combined), Export CSV
- **AgentProfile.tsx** (Profile): Agent card with stats (assigned customers, today's total, month total, txn count), logout

## Removed from agent view
- Admin/collector mode toggle
- Loan approval access
- Customer creation
- Search bars on Today and Collections
- AgentPending, AgentEMICollection, AgentLoanVerification tabs (files kept on disk, not imported)

**Why:** Clean separation — agents are collectors only. Admin functions belong to OrgDashboard (owner/manager).

## How to apply
When adding new agent features, always: (1) import CollectDialog from root `@/components/agent/CollectDialog`, (2) pass orgId/agentId/orgName/agentName props, (3) set customer state to open dialog, null to close.
