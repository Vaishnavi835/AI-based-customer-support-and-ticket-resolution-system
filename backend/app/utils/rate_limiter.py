"""
Rate limiter configuration — shared Limiter instance.

Separated into its own module to avoid circular imports between
main.py and auth.py.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

# Fix #6: Rate limiter — shared instance used by auth routes
limiter = Limiter(key_func=get_remote_address)
