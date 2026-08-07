#!/usr/bin/env bash
set -eo pipefail

# ==============================================================================
# CI Verbose Error Leakage Linter for pageel-crm
# Scans API handlers under src/pages/api/ to prevent raw error leaks.
# ==============================================================================

echo "🔍 Running CI Verbose Error Leakage Linter on src/pages/api/..."

# Search for ungated raw error message details
UNGUARDED_LEAKS=$(grep -rn 'details:.*err\.message\|details:.*error\.message' src/pages/api/ | grep -v 'import.meta.env.DEV' || true)

if [ -n "$UNGUARDED_LEAKS" ]; then
  echo "❌ SECURITY LINT FAILED: Found ungated verbose error leaks in API handlers!"
  echo "The following lines return raw error messages without import.meta.env.DEV gate or safeErrorResponse():"
  echo "$UNGUARDED_LEAKS"
  echo ""
  echo "👉 Fix: Replace with safeErrorResponse(err, 'User friendly message') from '@/lib/error-handler'."
  exit 1
else
  echo "✅ SECURITY LINT PASSED: Zero ungated verbose error leaks found in API handlers."
  exit 0
fi
