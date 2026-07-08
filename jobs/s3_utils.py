import os

import boto3


def is_s3_storage_configured() -> bool:
  return bool(os.environ.get("BUCKET_NAME"))


def _get_s3_client():
  return boto3.client(
    "s3",
    endpoint_url=os.environ.get("BUCKET_ENDPOINT"),
    aws_access_key_id=os.environ.get("BUCKET_ACCESS_KEY"),
    aws_secret_access_key=os.environ.get("BUCKET_SECRET_KEY"),
    region_name=os.environ.get("BUCKET_REGION"),
  )


def generate_presigned_download_url(
  key: str,
  filename: str,
  expires_in: int = 300,
) -> str:
  client = _get_s3_client()
  return client.generate_presigned_url(
    "get_object",
    Params={
      "Bucket": os.environ["BUCKET_NAME"],
      "Key": key,
      "ResponseContentDisposition": f'attachment; filename="{filename}"',
    },
    ExpiresIn=expires_in,
  )


def generate_presigned_upload_url(
  key: str,
  content_type: str = "application/octet-stream",
  expires_in: int = 600,
) -> str:
  client = _get_s3_client()
  return client.generate_presigned_url(
    "put_object",
    Params={
      "Bucket": os.environ["BUCKET_NAME"],
      "Key": key,
      "ContentType": content_type,
    },
    ExpiresIn=expires_in,
  )
