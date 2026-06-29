# Nexus SaaS – General Guide & Getting Started

## Overview
Welcome to Nexus! This guide explains what Nexus is, how to get started quickly, and how to get help when you need it.

---

## 1. What is Nexus?

Nexus is a SaaS platform that helps businesses manage customer support, automate ticket resolution using AI, and collaborate across support teams. Key capabilities include:

- **AI-Powered Ticket Resolution** — Automatically resolves common support tickets using your Knowledge Base
- **Multi-Role Dashboard** — Separate views for Admins, Agents, and Customers
- **Knowledge Base Management** — Upload documents that train your AI support bot
- **Escalation Workflows** — Routes complex tickets to human agents automatically
- **Analytics & Reporting** — Track resolution rates, agent performance, and ticket trends
- **REST API** — Integrate Nexus into any existing product or workflow

---

## 2. Getting Started in 5 Steps

### Step 1: Create Your Account
- Sign up at `app.nexus.io/signup`
- Verify your email
- You start on the Free plan automatically

### Step 2: Set Up Your Knowledge Base
- Go to **Admin Dashboard → Knowledge Base → Add Document**
- Upload support documents (PDF, Markdown, or plain text)
- The AI indexes them automatically within 1–2 minutes

### Step 3: Configure Your Team
- Go to **Settings → Team → Invite Member**
- Add agents who will handle escalated tickets
- Assign roles: Admin, Agent, or Viewer

### Step 4: Test the AI
- Log in as a Customer (or use a test account)
- Submit a sample support ticket
- Verify the AI responds correctly from your Knowledge Base

### Step 5: Go Live
- Share your customer portal link: `app.nexus.io/portal/YOUR_COMPANY`
- Customers can now submit tickets and get instant AI support

---

## 3. User Roles Explained

| Role | What They Can Do |
|------|-----------------|
| **Admin** | Full access — manage KB, team, billing, settings, view all tickets |
| **Agent** | Handle assigned tickets, view escalation queue, respond to customers |
| **Customer** | Submit tickets, view their own ticket history, receive AI responses |

---

## 4. How the AI Resolves Tickets

When a customer submits a ticket:
1. The AI searches your Knowledge Base using semantic vector search (FAISS)
2. It finds the most relevant document(s)
3. It generates a response using that content
4. If confidence is low, or the ticket is complex, it escalates to an agent

The AI escalates automatically when:
- Sensitive keywords are detected (e.g. "refund", "legal", "urgent")
- Customer sentiment is very negative
- The same issue has been raised 3+ times without resolution
- The customer explicitly requests a human agent

---

## 5. Contacting Nexus Support

| Channel | Use For | Response Time |
|---------|---------|---------------|
| `support@nexus.io` | General issues | 24 hours (Pro), 48 hours (Free) |
| `billing@nexus.io` | Payment & invoice issues | 24 hours |
| `api-support@nexus.io` | API & integration issues | 24 hours (Pro) |
| Live Chat (dashboard) | Urgent issues | Real-time (Pro/Enterprise) |
| Community Forum | General questions | Community-driven |

**Community Forum:** `community.nexus.io`
**Documentation:** `docs.nexus.io`
**Status Page:** `status.nexus.io`

---

## 6. Service Level Agreement (SLA)

| Plan | Uptime Guarantee | Support Response |
|------|-----------------|-----------------|
| Free | No SLA | 48 hours |
| Pro | 99.9% uptime | 24 hours |
| Enterprise | 99.99% uptime | 4 hours (dedicated manager) |

If uptime falls below the guaranteed SLA, Pro and Enterprise customers are eligible for service credits. Contact `billing@nexus.io` to claim.

---

## 7. System Requirements

Nexus works in any modern browser:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

No installation required. Mobile-friendly dashboard available at `app.nexus.io`.

For the REST API, any HTTP client works (Python, Node.js, cURL, Postman, etc.)

---

## 8. Frequently Asked General Questions

**Q: Is my data secure?**
Yes. All data is encrypted at rest (AES-256) and in transit (TLS 1.3). We are SOC 2 Type II certified.

**Q: Can I use Nexus in my own language?**
The dashboard supports English, Spanish, French, German, and Japanese. AI responses are generated in the language the customer writes in.

**Q: Is there a mobile app?**
Not yet. Our mobile-optimized web app works on all devices. A native mobile app is on our roadmap for Q3 2026.

**Q: Can I export all my data?**
Yes. Go to **Settings → Data → Export All** to download a full export in JSON or CSV format.

**Q: How do I report a bug?**
Email `support@nexus.io` with steps to reproduce, screenshots, and your browser/OS version.

---

## Need Help?
- Documentation: `docs.nexus.io`
- Support: `support@nexus.io`
- Community: `community.nexus.io`
- Status: `status.nexus.io`
