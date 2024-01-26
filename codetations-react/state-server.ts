// state server
// endpoints:
// /listen
//    clients receive state update push
// /save annotation state
//    push state to listeners (who didn't initiate?)
// (/read annotation state)
import fs from 'fs';

import WebSocket from 'ws';

// Create a WebSocket server
const wss = new WebSocket.Server({ port: 3001 })

let stateURI = '';

wss.on('connection', (ws:WebSocket.WebSocket) => {
  console.log('new connection');
  ws.on('message', (message) => {
    console.log(`Received message => ${message}`)
    const messageObj = JSON.parse(message.toString());
    
    if (messageObj.type === 'listen') {
      const state = fs.readFileSync(stateURI, 'utf8');
      ws.send(state)
    } else if (messageObj.type === 'save') {
      // read file uri from req.body
      stateURI = messageObj.stateURI;
      const state = messageObj.state;
    
      // open the file and save the new state
      fs.writeFile(stateURI, JSON.stringify(state), (err: any) => {
        if (err) {
          console.error(err);
          return;
        }
        console.log('File saved.');
      });
    
      // send state to all listeners
      wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(state);
        }
      })
    }
  })
})