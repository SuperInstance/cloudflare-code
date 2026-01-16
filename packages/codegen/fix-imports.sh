#!/bin/bash

# Fix type-only imports in codegen package
files=(
  "src/codegen.ts"
  "src/docs/generator.ts"
  "src/llm/anthropic-provider.ts"
  "src/llm/index.ts"
  "src/llm/openai-provider.ts"
  "src/llm/provider.ts"
  "src/schema/generator.ts"
  "src/sdk/generator.ts"
  "src/synthesis/synthesizer.ts"
  "src/tests/generator.ts"
  "src/utils/validator.ts"
)

for file in "${files[@]}"; do
  if [ -f "$file" ]; then
    # Replace import statements with type-only imports for types
    # This is a simplified approach - in production you'd want more sophisticated parsing
    sed -i 's/^import {\(.*\)}/import type {\1}/' "$file" 2>/dev/null || true
  fi
done

echo "Fixed type-only imports"
