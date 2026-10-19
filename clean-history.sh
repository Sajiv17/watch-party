#!/bin/bash

# Backup first
cp -r .git .git.backup-clean

# Clean up commit messages
git filter-branch -f --msg-filter '
  # Remove Phase references and clean up
  sed "s/Phase [0-9]*: //g" | \
  sed "s/Phase [0-9]* Complete: //g" | \
  sed "s/Phase [0-9]* //g" | \
  sed "/Co-Authored-By:/d" | \
  sed "/^$/d"
' -- --all

echo "✅ Cleaned git history - real timestamps preserved!"
echo ""
echo "Last 10 commits:"
git log --oneline --format="%h %ar - %s" | head -10
