#!/bin/bash

echo "pushing to $GH_REPO [via travis]"
export REPO_URL="https://$GH_TOKEN@github.com/$GH_REPO.git"
git branch -a
echo "STATUS"
git status
echo "remotes pre pre-authorized remote url"
git remote add origin $REPO_URL
git clone $REPO_URL
git pull origin csv -m ":rocket: merge new csvs"
python python/index_builder.py
git commit -am ":rocket: new deploy from travis-ci"
git push origin gh-pages
