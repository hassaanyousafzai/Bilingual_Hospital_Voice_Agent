from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application configuration loaded from environment / backend/.env."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_stt_model: str = "whisper-large-v3-turbo"
    # Neural TTS (Groq Orpheus). Requires one-time terms acceptance on the Groq console.
    groq_tts_model_en: str = "canopylabs/orpheus-v1-english"
    groq_tts_model_ar: str = "canopylabs/orpheus-arabic-saudi"
    groq_tts_voice_en: str = "tara"
    groq_tts_voice_ar: str = "tara"

    # Gemini (Google AI Studio). Natural female voices + fast LLM, generous free limits.
    # Get a free key at https://aistudio.google.com/apikey
    gemini_api_key: str = ""
    gemini_chat_model: str = "gemini-2.5-flash"  # fast brain; avoids Groq rate limits
    gemini_tts_model: str = "gemini-2.5-flash-preview-tts"
    gemini_tts_voice: str = "Leda"  # warm female; alts: Kore, Aoede, Sulafat, Achernar

    # LLM provider preference: auto (gemini → groq), gemini, or groq.
    llm_provider: str = "auto"

    # TTS provider preference: auto (gemini → groq), gemini, groq, or browser.
    tts_provider: str = "auto"

    @property
    def tts_ready(self) -> bool:
        if self.tts_provider == "browser":
            return False
        if self.tts_provider == "gemini":
            return bool(self.gemini_api_key.strip())
        if self.tts_provider == "groq":
            return bool(self.groq_api_key.strip())
        return bool(self.gemini_api_key.strip() or self.groq_api_key.strip())

    @property
    def active_tts_provider(self) -> str:
        if self.tts_provider in ("gemini", "groq", "browser"):
            return self.tts_provider
        if self.gemini_api_key.strip():
            return "gemini"
        if self.groq_api_key.strip():
            return "groq"
        return "browser"

    database_url: str = "sqlite:///./hospital_demo.db"
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def llm_enabled(self) -> bool:
        # True if any chat LLM is configured (Gemini or Groq).
        return bool(self.gemini_api_key.strip() or self.groq_api_key.strip())

    @property
    def groq_enabled(self) -> bool:
        return bool(self.groq_api_key.strip())

    @property
    def active_llm_provider(self) -> str:
        if self.llm_provider in ("gemini", "groq"):
            return self.llm_provider
        if self.gemini_api_key.strip():
            return "gemini"
        if self.groq_api_key.strip():
            return "groq"
        return "none"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
