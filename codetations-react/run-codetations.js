#!/usr/bin/env node

const { exec } = require('child_process');

exec('npx concurrently -c auto -n "webpack,retag-server,document-server" "node ./node_modules/react-scripts/bin/react-scripts.js start" "node ./server/lib/retag-server.js" "node ./server/lib/document-server.js"', (error, stdout, stderr) => {
  if (error) {
    console.error(`exec error: ${error}`);
    return;
  }
  console.log(`stdout: ${stdout}`);
  console.error(`stderr: ${stderr}`);
});