#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
output_dir="${project_root}/.pages-dist"

mkdir -p "${output_dir}"

"${project_root}/node_modules/.bin/esbuild" \
  "${project_root}/github-entry.tsx" \
  --bundle \
  --minify \
  --platform=browser \
  --format=iife \
  --jsx=automatic \
  --outfile="${output_dir}/app.js"

cp "${project_root}/app/globals.css" "${output_dir}/styles.css"
cp "${project_root}/github-pages/index.html" "${output_dir}/index.html"
cp "${project_root}/github-pages/index.html" "${output_dir}/404.html"
cp "${project_root}/public/favicon.svg" "${output_dir}/favicon.svg"
cp "${project_root}/public/og.png" "${output_dir}/og.png"
: > "${output_dir}/.nojekyll"

node --check "${output_dir}/app.js"

for required_file in index.html 404.html app.js styles.css favicon.svg og.png .nojekyll; do
  test -f "${output_dir}/${required_file}"
done

for referenced_file in app.js styles.css favicon.svg og.png; do
  test -f "${output_dir}/${referenced_file}"
done

echo "GitHub-Pages-Build vollständig: ${output_dir}"
