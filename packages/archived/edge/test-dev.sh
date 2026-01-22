#!/bin/bash
cd /home/eileen/projects/claudeflare/packages/edge
npx wrangler dev src/index.ts --local --port 8787 --compatibility-date=2024-01-01
