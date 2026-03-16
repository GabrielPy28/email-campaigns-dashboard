from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field

# Configuración de la aplicación
class Settings(BaseSettings):

    # Información de la aplicación
    app_name: str = "Email Campaigns & Tracking API"
    description: str = (
        "Backend service for email campaigns, SMTP sending via Brevo, "
        "and open/click tracking with reporting."
    )
    version: str = "0.1.0"
    environment: str = "development"

    # Base de datos
    database_url: str = "postgresql+psycopg2://postgres:postgres@db:5432/email_campaigns"
    redis_url: str = "redis://redis:6379/0"

    # Brevo SMTP (prod / pruebas externas)
    brevo_smtp_api_key: str | None = None    
    brevo_smtp_server: str | None = None
    brevo_smtp_port: int | None = None
    brevo_smtp_user: str | None = None
    brevo_http_api_key: str | None = None

    # SMTP genérico (dev: Gmail, prod: Brevo u otro)
    smtp_host: str | None = None
    smtp_port: int | None = None
    smtp_user: str | None = None
    smtp_password: str | None = None
    api_key: str | None = None

    # Supabase (para autenticación de usuarios)
    supabase_url: str | None = None
    supabase_public_key: str | None = None
    supabase_secret_key: str | None = None

    # JWT (para autenticación de usuarios)
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 1 día (24 * 60)

    # IPGeolocation API Key
    ipgeolocation_api_key: str | None = Field(
        default=None,
        env="IPGEOLOCATION_API_KEY",
    )

    # CORS (producción: lista de orígenes separados por coma)
    cors_origins: str = "*"

    class Config:
        env_file = ".env"
        env_prefix = ""
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    return Settings()

