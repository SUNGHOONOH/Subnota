import httpx

from app.core.config import settings
from app.db import DatabaseRow
from app.features.inbox.constants import USER_AGENT
from app.features.inbox.utils import extract_youtube_video_id


def fetch_youtube_metadata(url: str | None) -> DatabaseRow:
    if not url:
        return {}

    video_id = extract_youtube_video_id(url)
    if settings.youtube_api_key and video_id:
        with httpx.Client(timeout=10, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "id": video_id,
                    "key": settings.youtube_api_key,
                    "part": "snippet,contentDetails",
                },
            )
            response.raise_for_status()
            items = response.json().get("items") or []
            if items:
                snippet = items[0].get("snippet") or {}
                thumbnails = snippet.get("thumbnails") or {}
                thumbnail = (
                    thumbnails.get("maxres")
                    or thumbnails.get("standard")
                    or thumbnails.get("high")
                    or thumbnails.get("medium")
                    or thumbnails.get("default")
                    or {}
                )
                return {
                    "provider": "youtube_data_api",
                    "video_id": video_id,
                    "title": snippet.get("title"),
                    "description": snippet.get("description"),
                    "thumbnail_url": thumbnail.get("url"),
                    "channel_title": snippet.get("channelTitle"),
                    "published_at": snippet.get("publishedAt"),
                    "duration": (items[0].get("contentDetails") or {}).get("duration"),
                }

    return fetch_youtube_oembed(url, video_id)


def fetch_youtube_oembed(url: str, video_id: str | None) -> DatabaseRow:
    try:
        with httpx.Client(timeout=10, headers={"User-Agent": USER_AGENT}) as client:
            response = client.get("https://www.youtube.com/oembed", params={"url": url, "format": "json"})
            response.raise_for_status()
            data = response.json()
            return {
                "provider": "youtube_oembed",
                "video_id": video_id,
                "title": data.get("title"),
                "description": None,
                "thumbnail_url": data.get("thumbnail_url"),
                "author_name": data.get("author_name"),
                "author_url": data.get("author_url"),
            }
    except Exception:
        return {"provider": "youtube_url", "video_id": video_id}
