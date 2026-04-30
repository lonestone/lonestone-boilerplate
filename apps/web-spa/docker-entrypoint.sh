#!/bin/sh
set -eu

HTML_ROOT=/usr/share/nginx/html

# Replace build-time placeholders in static assets. awk avoids sed pitfalls with
# characters like & or / in URLs (query strings, paths).
replace_placeholders_in_file() {
  _file="$1"
  _tmp="${_file}.tmp"
  VITE_API_URL="${VITE_API_URL:-}" \
  VITE_STORAGE_PUBLIC_BASE_URL="${VITE_STORAGE_PUBLIC_BASE_URL:-}" \
    awk '
      BEGIN {
        api = ENVIRON["VITE_API_URL"]
        storage = ENVIRON["VITE_STORAGE_PUBLIC_BASE_URL"]
      }
      {
        gsub(/%VITE_API_URL%/, api)
        gsub(/%VITE_STORAGE_PUBLIC_BASE_URL%/, storage)
        print
      }
    ' "$_file" > "$_tmp" && mv "$_tmp" "$_file"
}

find "$HTML_ROOT" -type f \( \
  -name '*.js' \
  -o -name '*.mjs' \
  -o -name '*.html' \
  -o -name '*.css' \
  -o -name '*.json' \
\) | while IFS= read -r f; do
  replace_placeholders_in_file "$f"
done

exec nginx -g 'daemon off;'
