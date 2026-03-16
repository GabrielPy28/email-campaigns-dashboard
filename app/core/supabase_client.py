"""Cliente Supabase para Auth (sign_in_with_password)."""
from supabase import create_client, Client

from app.core.config import get_settings


def get_supabase_client() -> Client:
    """Cliente con SUPABASE_SECRET_KEY o SUPABASE_PUBLIC_KEY."""
    settings = get_settings()
    if not settings.supabase_url:
        raise ValueError("Configure SUPABASE_URL en .env")
    key = settings.supabase_secret_key or settings.supabase_public_key
    if not key:
        raise ValueError("Configure SUPABASE_SECRET_KEY o SUPABASE_PUBLIC_KEY en .env")
    return create_client(settings.supabase_url, key)
