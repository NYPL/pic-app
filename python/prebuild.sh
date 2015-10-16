#!/bin/bash

echo ""
echo "#### STARTED TRAVIS MAGIC ON $GH_REPO"

export REPO=$(git config remote.origin.url)
export BRANCH="gh-pages"
export REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"

git config --global user.name "travis-bot"
git config --global user.email "travis"

# python ./python/index_builder.py

echo ""
echo "#### STATUS"
echo "branch"
git branch -a

echo ""
echo "status"
git status

echo ""
echo "rename"
git remote rename origin old

echo ""
echo "new origin"
git remote add origin $REPO_URL
git config remote.origin.url $REPO_URL
git checkout origin/$BRANCH

echo ""
echo "new branches:"
git branch -a

echo ""
echo "adding csv"
git add csv

git commit -m ":rocket: new deploy from travis-ci"

echo ""
echo "Pulling latest gh-pages..."

git branch $BRANCH origin/$BRANCH

echo ""
echo "Checkout"
git checkout $BRANCH

echo ""
echo "Merge"
git merge csv -m ":rocket: merge from travis-ci"

echo ""
echo "Push"

git push origin $BRANCH

echo ""
echo "#### DEPLOY COMPLETE"