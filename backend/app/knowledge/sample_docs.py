"""
Knowledge base documents for RAG.
Each entry is one "chunk" — a self-contained piece of information.
Keep each chunk focused on ONE topic so retrieval stays accurate.
"""

KNOWLEDGE_BASE = [
    {
        "id": "kb_001",
        "category": "billing",
        "title": "Refund Policy",
        "content": (
            "Customers are eligible for a full refund within 30 days of purchase. "
            "To request a refund, contact support with your order ID. "
            "Refunds are processed within 5-7 business days to the original payment method. "
            "After 30 days, only store credit is available."
        ),
    },
    {
        "id": "kb_002",
        "category": "billing",
        "title": "Duplicate Charge",
        "content": (
            "If you were charged twice for the same order, this is usually caused by a "
            "payment gateway timeout. The duplicate charge is automatically reversed within "
            "3-5 business days. If it persists after 5 days, contact support with both "
            "transaction IDs and we will escalate to the billing team immediately."
        ),
    },
    {
        "id": "kb_003",
        "category": "authentication",
        "title": "Password Reset",
        "content": (
            "To reset your password, click 'Forgot Password' on the login page and enter "
            "your registered email. You will receive a reset link within 5 minutes. "
            "Check your spam folder if you don't see it. The link expires in 1 hour. "
            "If you no longer have access to your email, contact support for identity verification."
        ),
    },
    {
        "id": "kb_004",
        "category": "authentication",
        "title": "Account Locked",
        "content": (
            "Accounts are temporarily locked after 5 failed login attempts for security. "
            "The lockout lasts 15 minutes and lifts automatically. "
            "If you believe your account was locked due to unauthorized access, "
            "contact support immediately to secure your account."
        ),
    },
    {
        "id": "kb_005",
        "category": "technical",
        "title": "App Not Loading",
        "content": (
            "If the application is not loading, try these steps in order: "
            "1. Clear your browser cache and cookies. "
            "2. Try a different browser. "
            "3. Disable browser extensions. "
            "4. Check our status page for ongoing incidents. "
            "If the issue persists, contact support with your browser version and OS."
        ),
    },
    {
        "id": "kb_006",
        "category": "account",
        "title": "Update Account Email",
        "content": (
            "To update your account email address, go to Account Settings and click "
            "'Change Email'. You will receive a verification link at the new email address. "
            "The change takes effect once you click the link. "
            "Your old email remains active until the new one is verified."
        ),
    },
    {
        "id": "kb_007",
        "category": "billing",
        "title": "Subscription Cancellation",
        "content": (
            "You can cancel your subscription at any time from Account Settings. "
            "Cancellation takes effect at the end of the current billing period. "
            "You will retain access until then and will not be charged again. "
            "Cancellations cannot be undone but you can re-subscribe at any time."
        ),
    },
    {
        "id": "kb_008",
        "category": "technical",
        "title": "Data Export",
        "content": (
            "To export your account data, go to Account Settings and click 'Export Data'. "
            "A CSV file with all your data will be emailed to you within 24 hours. "
            "This includes your ticket history, chat history, and account information. "
            "Data exports are limited to once per 30 days."
        ),
    },
    {
        "id": "kb_009",
        "category": "account",
        "title": "Account Setup Guide",
        "content": (
            "To set up your account, enter your full name, email, and a secure password. "
            "You must verify your email by clicking the confirmation link sent to your inbox. "
            "Profile settings can be adjusted in the profile dashboard, including updating your avatar and email."
        ),
    },
    {
        "id": "kb_010",
        "category": "general",
        "title": "Getting Started with Nexus",
        "content": (
            "Nexus is our intelligent customer support platform. To get started, you can browse "
            "active tickets, escalate unresolved conversations, and chat with AI assistant. "
            "Support team is available 24/7. Response times depend on ticket severity: critical issues "
            "are addressed under 15 minutes."
        ),
    },
    {
        "id": "kb_011",
        "category": "company policies",
        "title": "Privacy Policy and GDPR Summary",
        "content": (
            "We value your privacy and comply with GDPR requirements. We collect minimal personal data "
            "including name and email for authentication. You have the right to request deletion of your account "
            "and export all your data via the settings panel at any time. We retain logs for up to 30 days."
        ),
    },
    {
        "id": "kb_012",
        "category": "product features",
        "title": "Nexus Product Features and Integrations",
        "content": (
            "Nexus includes a live real-time dashboard, ticketing queue, agent workspace, and an automated "
            "AI triage system. We support webhooks and API integrations to sync with third-party software like "
            "Slack and Jira. View details on each product plan from the product comparison page."
        ),
    },
]