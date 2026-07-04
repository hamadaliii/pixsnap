"""
PixSnap — provider-based object storage.

Lets PixSnap move thumbnails / previews / ZIPs / originals off Supabase Storage
onto Cloudflare R2 or AWS S3 to cut Supabase egress, WITHOUT removing Supabase
(which stays the fallback and keeps serving existing files).

Design:
  StorageProvider  — abstract interface (8 methods)
  SupabaseStorageProvider — wraps supabase.storage (backward compatible)
  R2StorageProvider       — Cloudflare R2 via S3-compatible boto3 client
  S3StorageProvider       — AWS S3 via boto3

get_storage_provider(name, supabase) returns the configured provider, and
falls back to Supabase if the requested one is missing credentials — so the
app never breaks if R2/S3 env vars are absent.
"""

import os
import io
from abc import ABC, abstractmethod
from typing import Optional

import boto3
from botocore.config import Config as BotoConfig


# ── Result container ────────────────────────────────────────────────────────
class StorageResult(dict):
    """Lightweight dict with provider/bucket/path/public_url for DB metadata."""
    pass


# ── Interface ───────────────────────────────────────────────────────────────
class StorageProvider(ABC):
    name: str = "base"
    bucket: str = ""

    @abstractmethod
    def upload_object(self, path: str, data: bytes, content_type: str = "application/octet-stream",
                      cache_control: str = "public, max-age=31536000, immutable") -> StorageResult: ...

    @abstractmethod
    def download_object(self, path: str) -> bytes: ...

    @abstractmethod
    def get_signed_url(self, path: str, expires_in: int = 300) -> Optional[str]: ...

    @abstractmethod
    def delete_object(self, path: str) -> bool: ...

    @abstractmethod
    def object_exists(self, path: str) -> bool: ...

    @abstractmethod
    def list_objects(self, prefix: str = "") -> list: ...

    @abstractmethod
    def get_public_url(self, path: str) -> str: ...

    @abstractmethod
    def get_metadata(self, path: str) -> dict: ...

    def result(self, path: str, public_url: str = None) -> StorageResult:
        return StorageResult(provider=self.name, bucket=self.bucket, path=path,
                             public_url=public_url or self.get_public_url(path))


# ── Supabase provider (backward compatible) ─────────────────────────────────
class SupabaseStorageProvider(StorageProvider):
    name = "supabase"

    def __init__(self, supabase_client, bucket: str = "event-photos"):
        self.sb = supabase_client
        self.bucket = bucket

    def upload_object(self, path, data, content_type="application/octet-stream",
                      cache_control="public, max-age=31536000, immutable"):
        self.sb.storage.from_(self.bucket).upload(
            path, data,
            {"content-type": content_type, "upsert": "true", "cache-control": cache_control},
        )
        return self.result(path)

    def download_object(self, path):
        return self.sb.storage.from_(self.bucket).download(path)

    def get_signed_url(self, path, expires_in=300):
        try:
            res = self.sb.storage.from_(self.bucket).create_signed_url(path, expires_in)
            return res.get("signedURL") or res.get("signedUrl")
        except Exception:
            return None

    def delete_object(self, path):
        try:
            self.sb.storage.from_(self.bucket).remove([path])
            return True
        except Exception:
            return False

    def object_exists(self, path):
        try:
            # list the parent folder and look for the file
            folder = "/".join(path.split("/")[:-1])
            name = path.split("/")[-1]
            items = self.sb.storage.from_(self.bucket).list(folder) or []
            return any(i.get("name") == name for i in items)
        except Exception:
            return False

    def list_objects(self, prefix=""):
        try:
            return self.sb.storage.from_(self.bucket).list(prefix) or []
        except Exception:
            return []

    def get_public_url(self, path):
        return self.sb.storage.from_(self.bucket).get_public_url(path)

    def get_metadata(self, path):
        try:
            folder = "/".join(path.split("/")[:-1])
            name = path.split("/")[-1]
            items = self.sb.storage.from_(self.bucket).list(folder) or []
            for i in items:
                if i.get("name") == name:
                    meta = i.get("metadata") or {}
                    return {"size": meta.get("size"), "content_type": meta.get("mimetype")}
        except Exception:
            pass
        return {}


# ── S3-compatible base (used by both R2 and S3) ─────────────────────────────
class _S3CompatibleProvider(StorageProvider):
    def __init__(self, *, endpoint_url, region, access_key, secret_key,
                 bucket, public_base_url=None, name="s3"):
        self.name = name
        self.bucket = bucket
        self.public_base_url = (public_base_url or "").rstrip("/")
        self.client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            region_name=region,
            aws_access_key_id=access_key,
            aws_secret_access_key=secret_key,
            config=BotoConfig(signature_version="s3v4", s3={"addressing_style": "path"}),
        )

    def upload_object(self, path, data, content_type="application/octet-stream",
                      cache_control="public, max-age=31536000, immutable"):
        self.client.put_object(
            Bucket=self.bucket, Key=path, Body=data,
            ContentType=content_type, CacheControl=cache_control,
        )
        return self.result(path)

    def download_object(self, path):
        obj = self.client.get_object(Bucket=self.bucket, Key=path)
        return obj["Body"].read()

    def get_signed_url(self, path, expires_in=300):
        try:
            return self.client.generate_presigned_url(
                "get_object", Params={"Bucket": self.bucket, "Key": path}, ExpiresIn=expires_in
            )
        except Exception:
            return None

    def delete_object(self, path):
        try:
            self.client.delete_object(Bucket=self.bucket, Key=path)
            return True
        except Exception:
            return False

    def object_exists(self, path):
        try:
            self.client.head_object(Bucket=self.bucket, Key=path)
            return True
        except Exception:
            return False

    def list_objects(self, prefix=""):
        try:
            resp = self.client.list_objects_v2(Bucket=self.bucket, Prefix=prefix)
            return [{"name": o["Key"], "size": o["Size"], "created_at": o["LastModified"].isoformat()}
                    for o in resp.get("Contents", [])]
        except Exception:
            return []

    def get_public_url(self, path):
        # Only meaningful when a public base URL (e.g. R2 custom domain) is set.
        if self.public_base_url:
            return f"{self.public_base_url}/{path}"
        # No public base → caller should use signed URLs instead.
        return self.get_signed_url(path, 3600) or ""

    def get_metadata(self, path):
        try:
            h = self.client.head_object(Bucket=self.bucket, Key=path)
            return {"size": h.get("ContentLength"), "content_type": h.get("ContentType")}
        except Exception:
            return {}


class R2StorageProvider(_S3CompatibleProvider):
    def __init__(self):
        account = os.environ.get("R2_ACCOUNT_ID", "")
        endpoint = os.environ.get("R2_ENDPOINT") or (f"https://{account}.r2.cloudflarestorage.com" if account else "")
        super().__init__(
            endpoint_url=endpoint,
            region="auto",
            access_key=os.environ.get("R2_ACCESS_KEY_ID", ""),
            secret_key=os.environ.get("R2_SECRET_ACCESS_KEY", ""),
            bucket=os.environ.get("R2_BUCKET", ""),
            public_base_url=os.environ.get("R2_PUBLIC_BASE_URL", ""),
            name="r2",
        )


class S3StorageProvider(_S3CompatibleProvider):
    def __init__(self):
        region = os.environ.get("AWS_S3_REGION", "eu-west-1")
        super().__init__(
            endpoint_url=None,  # default AWS endpoint
            region=region,
            access_key=os.environ.get("AWS_S3_ACCESS_KEY_ID", ""),
            secret_key=os.environ.get("AWS_S3_SECRET_ACCESS_KEY", ""),
            bucket=os.environ.get("AWS_S3_BUCKET", ""),
            public_base_url=os.environ.get("AWS_S3_PUBLIC_BASE_URL", ""),
            name="s3",
        )


# ── Config checks + factory ─────────────────────────────────────────────────
def _r2_configured() -> bool:
    return bool(os.environ.get("R2_ACCESS_KEY_ID") and os.environ.get("R2_SECRET_ACCESS_KEY")
                and os.environ.get("R2_BUCKET") and (os.environ.get("R2_ENDPOINT") or os.environ.get("R2_ACCOUNT_ID")))


def _s3_configured() -> bool:
    return bool(os.environ.get("AWS_S3_ACCESS_KEY_ID") and os.environ.get("AWS_S3_SECRET_ACCESS_KEY")
                and os.environ.get("AWS_S3_BUCKET"))


def provider_configured(name: str) -> bool:
    if name == "r2":
        return _r2_configured()
    if name == "s3":
        return _s3_configured()
    return True  # supabase always available


def get_storage_provider(supabase_client, name: str = None) -> StorageProvider:
    """
    Return the requested provider, or the STORAGE_PROVIDER env default.
    Falls back to Supabase if the chosen provider is not fully configured,
    so the app never breaks when R2/S3 credentials are missing.
    """
    name = (name or os.environ.get("STORAGE_PROVIDER", "supabase")).lower()
    try:
        if name == "r2" and _r2_configured():
            return R2StorageProvider()
        if name == "s3" and _s3_configured():
            return S3StorageProvider()
    except Exception as e:
        print(f"[storage] provider '{name}' init fel, fallback→supabase: {e}")
    return SupabaseStorageProvider(supabase_client)


def get_provider_by_name(supabase_client, name: str, bucket: str = None) -> StorageProvider:
    """Explicit provider by stored metadata (for reading old files back)."""
    name = (name or "supabase").lower()
    if name == "r2" and _r2_configured():
        return R2StorageProvider()
    if name == "s3" and _s3_configured():
        return S3StorageProvider()
    return SupabaseStorageProvider(supabase_client, bucket or "event-photos")
