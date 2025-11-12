let pc: RTCPeerConnection;
let dataChannel: RTCDataChannel;
let ws: WebSocket;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:numb.viagenie.ca:3478',
            credential: 'muazkh',       // public demo password
            username: 'webrtc@live.com'
        }
    ]
};

export function initConnection(onDataReceived: Function) {

    ws = new WebSocket('wss://crossdrop-vwxr.onrender.com/');
    pc = new RTCPeerConnection(configuration);

    ws.onmessage = handleSignalingMessage;

    pc.oniceconnectionstatechange = () => {
        console.log('ICE state changed to:', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
        console.log('Connection state changed to:', pc.connectionState);
    };

    pc.onicecandidate = (event) => {
        if (event.candidate) {
            console.log("Sending ICE candidate...");

            ws.send(JSON.stringify({type: "candidate", payload: event.candidate}));
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
export async function createOffer(onDataReceived: Function) {
    console.log("Creating data channel...");

    const channel = pc.createDataChannel("fileTransfer")
    setupDataChannel(channel, onDataReceived);

    console.log("Creating offer...")
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer)

    ws.send(JSON.stringify({type: "offer", payload: offer}))
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

async function handleSignalingMessage(event: MessageEvent) {
    const msg = JSON.parse(event.data)

    if (msg.type === 'offer') {
        console.log("Received offer");
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))

        console.log("Creating answer...");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        ws.send(JSON.stringify({type: 'answer', payload: answer}))
    } else if (msg.type === 'answer') {
        console.log("Received answer")
        await pc.setRemoteDescription(new RTCSessionDescription(msg.payload))
    } else if (msg.type === 'candidate') {
        console.log("Received ICE candidate")
        await pc.addIceCandidate(new RTCIceCandidate(msg.payload))
    }
}
