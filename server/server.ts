import dotenv from 'dotenv';
import {WebSocketServer} from 'ws';
import express from "express";
import cors from "cors";

dotenv.config();
const PORT = process.env.PORT || 8000;
const TURN_API_KEY = process.env.TURN_API_KEY

const app = express()

app.use(cors({
  origin: "https://cross-drop.vercel.app",
  methods: ["GET", "POST"],
  credentials: true, // optional if you use cookies
}));

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

app.get("/api/turn", async (req: express.Request, res: express.Response) => {
  try {
    const iceServers = [
        {
            urls: "stun:stun.relay.metered.ca:80",
        },
        {
            urls: "turn:standard.relay.metered.ca:80",
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD,
        },
        {
            urls: "turn:standard.relay.metered.ca:80?transport=tcp",
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD,
        },
        {
            urls: "turn:standard.relay.metered.ca:443",
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD,
        },
        {
            urls: "turns:standard.relay.metered.ca:443?transport=tcp",
            username: process.env.TURN_USERNAME,
            credential: process.env.TURN_PASSWORD,
        },
    ]

    res.status(200).json(iceServers); // send ICE servers to frontend
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate TURN credentials" });
  }
});

const server = app.listen(PORT, () => console.log("Server running"))
const wss = new WebSocketServer({server});

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

    ws.on('error', () => {
        console.log("Client errored");
        clientIds.delete(ws)
        broadcastClients
    })
})