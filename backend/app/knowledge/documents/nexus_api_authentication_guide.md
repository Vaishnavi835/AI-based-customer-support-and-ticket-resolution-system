Overview

Nexus uses API keys and OAuth 2.0 bearer tokens to authenticate all API requests. Every request must include a valid credential in the Authorization header. Unauthenticated requests will return a 401 Unauthorized error.


1. Generating Your API Key


Log in to your Nexus dashboard at app.nexus.io.
Navigate to Settings → Developer → API Keys.
Click Generate New Key.
Copy and store your key immediately — it will not be shown again.
Assign a label (e.g., "Production", "Testing") to identify the key later.



Important: Never share your API key publicly or commit it to version control (GitHub, GitLab, etc.).




2. Using Your API Key in Requests

Include your API key in the Authorization header of every request:

Authorization: Bearer YOUR_API_KEY

Example (cURL):

bashcurl -X GET https://api.nexus.io/v1/users \
  -H "Authorization: Bearer nxs_live_abc123xyz456"

Example (Python):

pythonimport requests

headers = {
    "Authorization": "Bearer nxs_live_abc123xyz456"
}
response = requests.get("https://api.nexus.io/v1/users", headers=headers)


3. API Key Prefixes

PrefixEnvironmentnxs_live_Productionnxs_test_Sandbox/Testing

Always use nxs_test_ keys during development to avoid affecting live data.


4. Common Authentication Errors

401 Unauthorized

Cause: Missing or invalid API key.
Fix:


Confirm the Authorization header is included in your request.
Check that your key starts with nxs_live_ or nxs_test_.
Regenerate the key from Settings if it was recently deleted or rotated.


403 Forbidden

Cause: Your API key does not have permission for this endpoint.
Fix:


Check your plan's API access level under Settings → Billing → Plan Details.
Upgrade to Pro or Enterprise for full API access.
Contact support if you believe this is an error.


429 Too Many Requests

Cause: You have exceeded the rate limit for your plan.
Fix:


Implement exponential backoff and retry logic in your code.
Check your current rate limit under Settings → Developer → Usage.
Upgrade your plan for higher rate limits.



5. Rotating Your API Key

If your key is compromised:


Go to Settings → Developer → API Keys.
Click Revoke next to the affected key.
Generate a new key immediately.
Update all services and environment variables that used the old key.



6. Rate Limits by Plan

PlanRequests/minuteRequests/dayFree201,000Pro20050,000EnterpriseUnlimitedUnlimited


7. OAuth 2.0 (Advanced)

For third-party integrations, Nexus supports OAuth 2.0 Authorization Code flow.

Authorization URL: https://auth.nexus.io/oauth/authorize
Token URL: https://auth.nexus.io/oauth/token
Scopes: read, write, admin

Contact support at api-support@nexus.io for OAuth client credentials.


Need Help?


Documentation: docs.nexus.io/api
Support: support@nexus.io
Status Page: status.nexus.io