/**
 * Closes the current peer connection and data channel
 */
export function closeConnection() {
    if (targetId) {
        ws.send(JSON.stringify({type: "close", target: targetId}))
    }
    targetId = undefined as any
    if (dataChannel) {
        try { dataChannel.close(); } catch {}
        dataChannel = undefined as any;
    }
    if (pc) {
        try { pc.close(); } catch {}
        pc = undefined as any;
    }
}


let pc: RTCPeerConnection;
let dataChannel: RTCDataChannel;
let ws: WebSocket;
let targetId: string;
let iceServers: RTCIceServer[] = [];

function setupPeerConnection(onDataReceived: Function, onConnectionStatusChange: Function) {
    const newPc = new RTCPeerConnection({ iceServers });
    newPc.oniceconnectionstatechange = async () => {
        console.log('ICE state changed to:', newPc.iceConnectionState);
        if (newPc.iceConnectionState === 'failed') {
            console.log("ICE connection failed");
        }
    };
    newPc.onconnectionstatechange = async () => {
        console.log('Connection state changed to:', newPc.connectionState);
        if (newPc.connectionState == 'connected') {
            onConnectionStatusChange("connected", targetId);
        } else if (newPc.connectionState == "connecting") {
            onConnectionStatusChange("connecting", targetId);
        } else {
            const stats = await newPc.getStats();
            let hasCandidatePair = false;
            stats.forEach((report) => {
                if (report.type === 'candidate-pair') {
                    hasCandidatePair = true;
                    console.log('Candidate Pair Report:', report);
                }
            });
            if (!hasCandidatePair) {
                onConnectionStatusChange("failed", targetId);
            }
        }
    };
    newPc.onicecandidateerror = (error) => {
        console.log("ICE error: ", error)
    };
    newPc.onicecandidate = (event) => {
        if (event.candidate && targetId) {
            console.log("Sending ICE candidate...");
            ws.send(JSON.stringify({type: "candidate", target: targetId, payload: event.candidate}));
        }
    };
    newPc.ondatachannel = (event) => {
        console.log("Data channel received");
        setupDataChannel(event.channel, onDataReceived)
    };
    return newPc;
}

async function fetchTurnServers() {
    try {
        const res = await fetch(import.meta.env.VITE_API_URL + "/api/turn");
        if (!res.ok) throw new Error("Failed to fetch TURN credentials");
        return await res.json();
    } catch (err) {
        console.error("Error fetching TURN servers:", err);
        return []; // fallback to empty, only STUN will be used
    }
}

export async function initConnection(onClientsReceived: Function, onConnectionStatusChange: Function, onDataReceived: Function) {

    iceServers = await fetchTurnServers()

    ws = new WebSocket(import.meta.env.VITE_WEBSOCKET_URL);

    ws.onmessage = (event) => handleSignalingMessage(event, onClientsReceived, onConnectionStatusChange, onDataReceived);
}

/**
 * Initiates the connection by sending an offer to the peer
 */
export async function createOffer(onDataReceived: Function, target: string, onConnectionStatusChange: Function) {
    pc = setupPeerConnection(onDataReceived, onConnectionStatusChange);
    targetId = target;
    console.log("Creating data channel...");
    const channel = pc.createDataChannel("fileTransfer");
    setupDataChannel(channel, onDataReceived);
    console.log("Creating offer...");
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    ws.send(JSON.stringify({type: "offer", target: targetId, payload: offer}));
}

export async function sendFile(file: File) {
    if (!dataChannel || dataChannel.readyState !== 'open') {
        console.warn("Data channel is not open.");
        return
    }

    console.log("Sending: ", file.name)
    dataChannel.binaryType = "arraybuffer";

    // send metadata
    dataChannel.send(JSON.stringify({
        type: 'metadata',
        payload: {
            name: file.name,
            size: file.size,
            type: file.type
        }
    }));

    // send chunks
    const CHUNK_SIZE = 64 * 1024;
    let offset = 0

    while (offset < file.size) {
        if (dataChannel.bufferedAmount > 1024 * 1024) {
            await new Promise<void>(resolve => {
                dataChannel.onbufferedamountlow = () => {
                    dataChannel.onbufferedamountlow = null; // clear listener
                    resolve()
                }
            })
        }

        const slice = file.slice(offset, offset + CHUNK_SIZE);
        const chunk = await slice.arrayBuffer();
        dataChannel.send(chunk);
        offset += chunk.byteLength;
    }

    dataChannel.send(JSON.stringify({
        type: "end",
        payload: {name: file.name}
    }));
    console.log("File sending complete.");

}

function setupDataChannel(channel: RTCDataChannel, onDataReceived: Function) {
    dataChannel = channel
    dataChannel.binaryType = "arraybuffer"

    let receivedChunks: ArrayBuffer[] = [];
    let fileMetaData: {name: string, size: number, type: string} | null = null

    dataChannel.onopen = () => console.log("Data channel is OPEN");
    dataChannel.onclose = () => {
        console.log("Data channel is CLOSED")

        receivedChunks = [];
        fileMetaData = null;
    };

    dataChannel.onmessage = (event) => {
        // Only handle file transfer messages here
        if (typeof event.data === 'string') {
            const msg = JSON.parse(event.data);
            if (msg.type === 'metadata') {
                fileMetaData = msg.payload;
                receivedChunks = [];
                console.log("Receiving file: ", fileMetaData);
            } else if (msg.type === 'end') {
                if (!fileMetaData) {
                    console.error("Received 'end' signal without metadata");
                    return;
                }
                console.log("File reception complete: ", fileMetaData);
                // reconstruct file
                const fileBlob = new Blob(receivedChunks, { type: fileMetaData.type });
                const fileUrl = URL.createObjectURL(fileBlob);
                onDataReceived({
                    name: fileMetaData.name,
                    url: fileUrl,
                    size: fileBlob.size
                });
                receivedChunks = [];
                fileMetaData = null;
            }
        } else if (event.data instanceof ArrayBuffer) {
            if (!fileMetaData) {
                console.error("Received chunk without metadata.");
                return;
            }
            receivedChunks.push(event.data);
        }
    };
}

async function handleSignalingMessage(event: MessageEvent, onClientsReceived: Function, onConnectionStatusChange: Function, onDataReceived: Function) {
    const msg = JSON.parse(event.data);

    if (msg.type === 'clients') {
        console.log("Clients received");
        onClientsReceived(msg.payload);
    } else if (msg.type === 'offer') {
        console.log("Received offer");
        pc = setupPeerConnection(onDataReceived, onConnectionStatusChange);
        targetId = msg.sender;
        if (!pc) {
            console.warn("No RTCPeerConnection available to set remote description (offer)");
            return;
        }
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        console.log("Creating answer...");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        ws.send(JSON.stringify({ type: 'answer', target: msg.sender, payload: answer }));
    } else if (msg.type === 'answer' || msg.type === 'candidate' || msg.type === 'close') {
        // Only ignore if target is set and does not match current targetId
        if (typeof msg.target !== 'undefined' && msg.sender !== targetId) {
            console.warn(`Ignoring signaling message for old or mismatched target: ${msg.target} (current: ${targetId})`);
            return;
        }
        if (msg.type === 'answer') {
            console.log("Received answer");
            if (!pc) {
                console.warn("No RTCPeerConnection available to set remote description (answer)");
                return;
            }
            await pc.setRemoteDescription(new RTCSessionDescription(msg.payload));
        } else if (msg.type === 'candidate') {
            console.log("Received ICE candidate");
            if (!pc) {
                console.warn("No RTCPeerConnection available to add ICE candidate");
                return;
            }
            await pc.addIceCandidate(new RTCIceCandidate(msg.payload));
        } else if (msg.type === 'close') {
            console.log("Received close signal. Closing connection.");
            closeConnection();
        }
    }
}
