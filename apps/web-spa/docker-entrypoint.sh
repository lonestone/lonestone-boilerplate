#!/bin/sh
set -e

# Replace %VITE_*% placeholders in static assets with runtime environment values
if [ -d /usr/share/nginx/html ]; then
  for file in $(find /usr/share/nginx/html -type f \( -name '*.js' -o -name '*.html' -o -name '*.css' \)); do
    for var in $(env | grep '^VITE_' | cut -d= -f1); do
      eval "value=\\$$var"
      sed -i "s|%${var}%|${value}|g" "$file"
    done
  done
fi
