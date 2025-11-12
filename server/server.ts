import {WebSocketServer} from 'ws';
import * as http from 'http'

const PORT = process.env.PORT || 8000;

const server = http.createServer();
const wss = new WebSocketServer({server});

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

wss.on("connection", (ws) => {

    console.log("Client connected")

    ws.on("message", (message) => {
        // broadcast message to all clients
        // just pass along the message basically
        console.log("Received connection message. Broadcasting...");

        wss.clients.forEach(client => {
            if (client !== ws && client.readyState === ws.OPEN) {
                client.send(message.toString())
            }
        })
    });

    ws.on('close', () => {
        console.log('Client disconnected');
    });
})