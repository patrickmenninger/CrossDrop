import {WebSocketServer} from 'ws';
import * as http from 'http'
import { randomUUID } from 'crypto';

const PORT = process.env.PORT || 8000;

const server = http.createServer();
const wss = new WebSocketServer({server});

server.listen(PORT, () => {
  console.log(`WebSocket server running on port ${PORT}`);
});

const clientIds = new Map()

function broadcastClients() {
    wss.clients.forEach(client => {

        if (client.readyState === client.OPEN) {
            const currentId = clientIds.get(client)
    
            client.send(JSON.stringify(
                {
                    type: "clients", 
                    payload: {
                        you: currentId, 
                        clients: Array.from(clientIds.values()).filter((clientId) => clientId !== currentId)
                    }
                }
            ))
        }

    })
}

wss.on("connection", (ws) => {

    console.log("Client connected")

    // Assign id and save it
    const id = crypto.randomUUID()
    clientIds.set(ws, id)

    // broadcast ids
    broadcastClients()

    ws.on("message", (message) => {
        console.log("Received connection message. Broadcasting...");

        const msg = JSON.parse(message.toString())

        wss.clients.forEach(client => {

            const currentId = clientIds.get(client)

            if (msg.target === currentId && client.readyState === client.OPEN) {
                client.send(JSON.stringify({
                    ...msg,
                    sender: clientIds.get(ws)
                }))
            }
        })

        // wss.clients.forEach(client => {
        //     if (client !== ws && client.readyState === ws.OPEN) {
        //         client.send(message.toString())
        //     }
        // })
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clientIds.delete(ws)
        broadcastClients()
    });
})