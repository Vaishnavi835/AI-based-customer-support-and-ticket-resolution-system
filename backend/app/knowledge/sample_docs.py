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
]