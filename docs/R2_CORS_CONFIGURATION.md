# R2 CORS configuration

Document the browser PUT CORS policy for `edusentrix-prod-storage`. This file is documentation only. Do not apply CORS in Cloudflare from the app or from a script.

## Why CORS is required

Authenticated and public-token uploads use:

1. `POST /api/storage/uploads/presign` or `POST /api/storage/public/uploads/presign`
2. Browser `XMLHttpRequest` `PUT` to the signed R2 URL
3. `POST .../complete`

The PUT is a cross-origin request from the Next.js origin to the R2 endpoint. R2 must allow those origins. The bucket stays private. Objects are never publicly listed or anonymously readable.

## Allowed origins

Do not use `*`.

- `https://tryedusentrix.app`
- `https://demo.tryedusentrix.app`
- Local Next origin(s), typically `http://localhost:3000`

If another production host is added later, add that exact origin here before applying CORS.

## Allowed methods

- `PUT`
- `GET`
- `HEAD`

`GET`/`HEAD` are only needed if a browser ever calls the signed download URL directly. Server-side `getObject` does not use CORS.

## Allowed headers

- `Content-Type`

The current presign helper sends `Content-Type` on the PUT. Do not add extra allowed headers unless the client actually sends them.

## Apply in Cloudflare

This is a manual Cloudflare dashboard or Wrangler operation. Do not apply it from this repository.

Example CORS rule shape:

```json
[
  {
    "AllowedOrigins": [
      "https://tryedusentrix.app",
      "https://demo.tryedusentrix.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

## Demo vs production

Demo host policy still denies `storage.upload`. CORS on the bucket does not grant demo uploads. Production-host testing can upload when Clerk auth or a valid public token is present.
