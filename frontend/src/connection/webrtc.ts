let pc: RTCPeerConnection;
let dataChannel: RTCDataChannel;
let ws: WebSocket;
let targetId: string;

async function fetchTurnServers() {
    try {
        const res = await fetch("https://crossdrop-vwxr.onrender.com/api/turn");
        if (!res.ok) throw new Error("Failed to fetch TURN credentials");
        return await res.json();
    } catch (err) {
        console.error("Error fetching TURN servers:", err);
        return []; // fallback to empty, only STUN will be used
    }
}

export async function initConnection(onDataReceived: Function, onClientsReceived: Function) {

    const iceServers = await fetchTurnServers()

    ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);
    pc = new RTCPeerConnection({iceServers})

    ws.onmessage = (event) => handleSignalingMessage(event, onClientsReceived);

    pc.oniceconnectionstatechange = () => {
        console.log('ICE state changed to:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
        console.log('Connection state changed to:', pc.connectionState);
    };

    pc.onicecandidateerror = (error) => {
        console.log("ICE error: ", error)
    }

    pc.onicecandidate = (event) => {
        if (event.candidate && targetId) {
            console.log("Sending ICE candidate...");

            ws.send(JSON.stringify({type: "candidate", target: targetId, payload: event.candidate}));
        }
    };

    pc.ondatachannel = (event) => {
        console.log("Data channel received");

        setupDataChannel(event.channel, onDataReceived)
    }
}

/**
 * Initiates the connection by sending an offer to the peer
 */
export async function createOffer(onDataReceived: Function, target: string) {
    console.log("Creating data channel...");

    const channel = pc.createDataChannel("fileTransfer")
    setupDataChannel(channel, onDataReceived);

    targetId = target

    console.log("Creating offer...")
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer)

    ws.send(JSON.stringify({type: "offer", target: targetId, payload: offer}))
}

export function sendFile(file: File) {
    if (dataChannel && dataChannel.readyState === 'open') {
        console.log("Sending: ", file.name)
        dataChannel.send(`(File content for ${file.name})`);
    } else {
        console.warn("Data channel is not open.");
    }
}

function setupDataChannel(channel: RTCDataChannel, onDataReceived: Function) {
    dataChannel = channel
    dataChannel.onopen = () => console.log("Data channel is OPEN");
    dataChannel.onclose = () => console.log("Data channel is CLOSED");

    dataChannel.onmessage = (event) => {
        console.log("Data channel message received:", event.data);
        onDataReceived(event.data)
    }
}

async function handleSignalingMessage(event: MessageEvent, onClientsReceived: Function) {
    const msg = JSON.parse(event.data)

    if (msg.type === 'clients') {
        console.log("Clients received")
        onClientsReceived(msg.payload)
    } else if (msg.type === 'offer') {
        console.log("Received offer");
        targetId = msg.sender
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))

        console.log("Creating answer...");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(JSON.stringify({type: 'answer', target: msg.sender, payload: answer}))
    } else if (msg.type === 'answer') {
        console.log("Received answer")
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))
    } else if (msg.type === 'candidate') {
        console.log("Received ICE candidate")
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload))
    }
}
