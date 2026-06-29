# Nexus SaaS – Product Features Guide

## Overview
This document explains all features available in Nexus, which plan they belong to, and how to use them effectively.

---

## 1. Features by Plan

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| AI Ticket Resolution | ✅ (50/mo) | ✅ Unlimited | ✅ Unlimited |
| Knowledge Base Documents | 5 docs | 100 docs | Unlimited |
| Team Members | 1 | 10 | Unlimited |
| API Access | Limited | Full | Full + Priority |
| Webhooks | ✗ | ✅ | ✅ |
| Custom Integrations | ✗ | ✗ | ✅ |
| Analytics Dashboard | Basic | Advanced | Custom |
| Escalation Workflows | Basic | Advanced | Fully Custom |
| Multiple Themes | ✗ | ✅ | ✅ |
| SSO / SAML Login | ✗ | ✗ | ✅ |
| Dedicated Support Manager | ✗ | ✗ | ✅ |
| White Labeling | ✗ | ✗ | ✅ |
| Data Export | ✗ | ✅ | ✅ |
| SLA Guarantee | ✗ | 99.9% | 99.99% |

---

## 2. AI Ticket Resolution

The core feature of Nexus — the AI automatically resolves incoming customer tickets.

**How it works:**
1. Customer submits a ticket
2. AI searches your Knowledge Base using semantic vector search (FAISS)
3. AI generates a personalized response using the most relevant documents
4. If the AI cannot confidently resolve the ticket, it escalates to a human agent

**Resolution confidence:**
- High confidence (>85%) → AI resolves and closes the ticket
- Medium confidence (50–85%) → AI responds but marks for agent review
- Low confidence (<50%) → Immediately escalated to agent queue

**To improve AI resolution rate:**
- Upload more detailed Knowledge Base documents
- Cover the most common ticket topics (billing, errors, account, features)
- Keep KB documents updated when policies change

---

## 3. Knowledge Base Management

The Knowledge Base is the brain of your AI — it reads from these documents to answer tickets.

**Supported file formats:**
- Markdown (.md)
- Plain text (.txt)
- PDF (.pdf)
- Word documents (.docx)

**Adding a document:**
1. Go to **Admin Dashboard → Knowledge Base → Add Document**
2. Select category (Technical, Billing, Account, etc.)
3. Upload file or paste text directly
4. Click **Save** — AI indexes automatically within 1–2 minutes

**Editing a document:**
1. Go to **Knowledge Base → All Documents**
2. Click the document → **Edit**
3. Make changes and click **Update**
4. FAISS index rebuilds automatically

**Deleting a document:**
1. Go to **Knowledge Base → All Documents**
2. Click the document → **Delete**
3. Confirm — index rebuilds without that document

> **Best practice:** Keep each document focused on one topic. Shorter, specific documents outperform long generic ones.

---

## 4. Escalation Workflows

Escalation automatically routes tickets to human agents when the AI cannot resolve them.

**Automatic escalation triggers:**
- **Keyword trigger** — Detects words like "refund", "lawsuit", "urgent", "cancel"
- **Sentiment trigger** — Detects highly negative or frustrated customer language
- **Risk trigger** — Detects security or account compromise issues
- **Turn-count trigger** — Escalates if AI has responded 3+ times without resolution
- **Low confidence trigger** — AI confidence score below threshold

**Manual escalation:**
- Customers can type "talk to a human" or "I want an agent" at any time
- Agents can also re-assign tickets to other agents from their dashboard

**Configuring escalation rules (Pro/Enterprise):**
1. Go to **Admin Dashboard → Settings → Escalation Rules**
2. Add keywords, adjust sentiment threshold, set turn-count limit
3. Click **Save Rules**

---

## 5. Webhooks (Pro & Enterprise)

Webhooks let you receive real-time notifications when events happen in Nexus.

**Available webhook events:**
- `ticket.created` — New ticket submitted
- `ticket.resolved` — Ticket resolved by AI or agent
- `ticket.escalated` — Ticket escalated to human agent
- `ticket.closed` — Ticket closed
- `agent.assigned` — Agent assigned to a ticket
- `kb.updated` — Knowledge Base document added or updated

**Setting up a webhook:**
1. Go to **Settings → Developer → Webhooks → Add Webhook**
2. Enter your endpoint URL (must be HTTPS)
3. Select the events you want to receive
4. Click **Save**
5. Nexus will send a test ping to verify your endpoint

**Webhook payload example:**
```json
{
  "event": "ticket.escalated",
  "timestamp": "2025-06-15T10:30:00Z",
  "data": {
    "ticket_id": "TKT-9921",
    "customer_email": "user@example.com",
    "reason": "keyword_trigger",
    "keyword_detected": "refund"
  }
}
```

---

## 6. Analytics Dashboard

**Free plan — Basic Analytics:**
- Total tickets this month
- Open vs closed ticket count
- Average response time

**Pro plan — Advanced Analytics:**
- AI resolution rate (% of tickets resolved without agent)
- Ticket volume by category
- Agent performance metrics
- Resolution time trends
- Last 30 days ticket breakdown
- Customer satisfaction scores (CSAT)

**Enterprise plan — Custom Analytics:**
- Everything in Pro
- Custom date range reports
- Export analytics as CSV or PDF
- API access to raw analytics data
- Custom dashboards built by your account manager

**Accessing analytics:**
- Go to **Admin Dashboard → Analytics**
- Use the date range picker to filter
- Click **Export** to download reports (Pro/Enterprise)

---

## 7. Multi-Theme Support (Pro & Enterprise)

Nexus offers 3 built-in UI themes for your dashboard:

| Theme | Colors | Best For |
|-------|--------|---------|
| Charcoal Gold | Dark charcoal + gold accents | Professional / corporate |
| Slate Ivory | Light slate + ivory tones | Clean / minimal |
| Midnight Rose | Dark midnight + rose accents | Modern / creative |

**Switching themes:**
1. Go to **Settings → Appearance → Theme**
2. Select a theme from the dropdown
3. Changes apply immediately — no refresh needed

---

## 8. Role-Based Access Control (RBAC)

Nexus has three built-in roles with specific permissions:

**Admin:**
- Full access to all features
- Manage team members, billing, settings
- View all tickets across all agents
- Manage Knowledge Base
- Access analytics

**Agent:**
- View and respond to assigned tickets
- Access escalation queue
- View their own performance metrics
- Cannot access billing or team settings

**Customer:**
- Submit support tickets
- View their own ticket history
- Receive AI and agent responses
- Cannot access dashboard features

---

## 9. Integrations

**Available out of the box:**
- Slack — Receive ticket notifications in your Slack workspace
- Email — Send/receive tickets via email
- Zapier — Connect Nexus to 5,000+ apps (Pro/Enterprise)

**Enterprise custom integrations:**
- Salesforce CRM sync
- HubSpot contact sync
- Jira issue creation for escalated tickets
- Microsoft Teams notifications
- Custom REST API integrations

**Setting up Slack integration:**
1. Go to **Settings → Integrations → Slack**
2. Click **Connect to Slack**
3. Authorize Nexus in your Slack workspace
4. Select the channel for notifications
5. Click **Save**

---

## 10. Data Export (Pro & Enterprise)

**What you can export:**
- All tickets (JSON or CSV)
- Knowledge Base documents
- Analytics reports (CSV or PDF)
- Team activity logs
- Full account data

**How to export:**
1. Go to **Settings → Data → Export**
2. Select data type and date range
3. Click **Generate Export**
4. Download link sent to your email within 5–10 minutes

---

## Need Help?
- Feature Documentation: `docs.nexus.io/features`
- Support: `support@nexus.io`
- Request a Feature: `nexus.io/feedback`
- Roadmap: `nexus.io/roadmap`
