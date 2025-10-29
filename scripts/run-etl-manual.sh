#!/bin/bash

# ========================================
# Run ETL Manually via CapRover
# ========================================

echo "🚀 Running ETL manually for 30 days..."
echo ""
echo "Command to run in CapRover container:"
echo ""
echo "  FETCH_DAYS=30 npm run run:once"
echo ""
echo "=========================================="
echo ""
echo "Via CapRover CLI:"
echo ""
echo "  caprover exec -a dd-dashboard"
echo "  FETCH_DAYS=30 npm run run:once"
echo ""
echo "Or direct one-liner:"
echo ""
echo "  caprover exec -a dd-dashboard -- bash -c 'FETCH_DAYS=30 npm run run:once'"
echo ""
echo "=========================================="

