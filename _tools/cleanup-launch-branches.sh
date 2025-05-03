#!/bin/bash

echo "🔹 Checking local branches..."
git branch | grep '^[[:space:]]*launch/' | sed 's/^[[:space:]]*//' | while read branch; do
  read -p "Delete local branch '$branch'? [y/N] " confirm
  if [[ $confirm == [yY] ]]; then
    git branch -D "$branch"
  fi
done

echo "🔹 Checking remote branches..."
git branch -r | grep 'origin/launch/' | sed 's|origin/||' | while read branch; do
  read -p "Delete remote branch 'origin/$branch'? [y/N] " confirm
  if [[ $confirm == [yY] ]]; then
    git push origin --delete "$branch"
  fi
done