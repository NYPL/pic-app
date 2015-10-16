#!/bin/bash

echo ""
echo "#### STARTED TRAVIS MAGIC ON $GH_REPO"

export REPO=$(git config remote.origin.url)
export REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"

git config --global user.name "travis-bot"
git config --global user.email "travis"

echo ""
echo "#### STATUS"
echo "Branch"
git branch -a

echo ""
echo "Status"
git status

# echo ""
# echo "rename"
# git remote rename origin old

# echo ""
# echo "new origin"
# git remote add origin $REPO_URL
# git config remote.origin.url $REPO_URL

git checkout origin/csv

# echo ""
# echo "new branches:"
# git branch -a

echo ""
echo "Run the index"
# python ./python/index_builder.py

echo ""
echo "Adding csv"
git add csv

git commit -m ":rocket: new deploy from travis-ci"

echo ""
echo "Checkout"
git checkout origin/gh-pages

echo ""
echo "Merge"
git merge csv -m ":rocket: merge from travis-ci"

echo ""
echo "Push"

git push $REPO_URL gh-pages

echo ""
echo "#### DEPLOY COMPLETE"