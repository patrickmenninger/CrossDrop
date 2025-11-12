let pc: RTCPeerConnection;
let dataChannel: RTCDataChannel;
let ws: WebSocket;
let targetId: string;

async function fetchTurnServers() {
    try {
        const res = await fetch(import.meta.env.VITE_API_URL + "api/turn");
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
        console.log("Data channel message received:", event.data);

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

                console.log("File reception complete: ", fileMetaData)

                // reconstruct file
                const fileBlob = new Blob(receivedChunks, {type: fileMetaData.type});
                const fileUrl = URL.createObjectURL(fileBlob);

                onDataReceived({
                    name: fileMetaData.name,
                    url: fileUrl,
                    size: fileBlob.size
                });

                receivedChunks = [];
                fileMetaData = null

            }
        } else if (event.data instanceof ArrayBuffer) {
            if (!fileMetaData) {
                console.error("Received chunk without metadata.");
                return;
            }

            receivedChunks.push(event.data)

        }
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
