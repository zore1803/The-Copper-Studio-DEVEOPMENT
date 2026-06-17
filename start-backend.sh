#!/bin/bash
mkdir -p /home/runner/workspace/.mongodb/data

if ! mongod --dbpath /home/runner/workspace/.mongodb/data --logpath /home/runner/workspace/.mongodb/mongod.log --fork --bind_ip 127.0.0.1 2>/dev/null; then
  echo "MongoDB already running or failed to start, continuing..."
fi

sleep 1
npm run dev
