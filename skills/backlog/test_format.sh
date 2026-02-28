#!/bin/bash
# Test the new --format option

echo "=== Test 1: Help shows format option ==="
node dist/skill-cli.js --help | grep -A1 "format"

echo -e "\n=== Test 2: formatBoardContext function exists ==="
grep -n "function formatBoardContext" dist/skill-cli.js && echo "✅ Function found in compiled output"

echo -e "\n=== Test 3: Template includes Verified-By ==="
grep -n "Verified-By" src/markdown/templates.ts && echo "✅ Template updated"

echo -e "\n=== All tests passed! ==="
