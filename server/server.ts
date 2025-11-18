import dotenv from 'dotenv';
import {WebSocketServer} from 'ws';
import express from "express";
import cors from "cors";
import {uniqueNamesGenerator, adjectives, colors, animals} from 'unique-names-generator';

dotenv.config();
const PORT = process.env.PORT || 8000;

const app = express()

app.use(cors({
  origin: ["https://cross-drop.vercel.app", "http://localhost:5173"],
  methods: ["GET", "POST"],
  credentials: true, // optional if you use cookies
}));

const clientIds = new Map()

function broadcastClients() {
    wss.clients.forEach(client => {

        if (client.readyState === client.OPEN) {
            const current = clientIds.get(client)
    
            client.send(JSON.stringify(
                {
                    type: "clients", 
                    payload: {
                        you: current, 
                        clients: Array.from(clientIds.values()).filter((client) => client.id !== current)
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
            urls: "stun:stun.l.google.com:19302",
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

    res.status(200).json(iceServers);
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
    clientIds.set(ws, {id, name: uniqueNamesGenerator({
        dictionaries: [colors, animals],
        separator: '-',
        style: 'lowerCase'
    })})

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

    });

    ws.on('close', () => {
        console.log('Client disconnected');
        clientIds.delete(ws)
        broadcastClients()
    });

    ws.on('error', () => {
        console.log("Client errored");
        clientIds.delete(ws)
        broadcastClients()
    })
})