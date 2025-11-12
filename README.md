# CrossDrop

A peer-to-peer file sharing application that allows you to send files directly between any two devices (e.g., Windows PC and iPhone) using only a web browser.

This project uses **WebRTC** for the direct, serverless file transfer and a **WebSocket** server for the initial connection "handshake" (signaling).

## 🎯 Project Goal

The goal is to learn the fundamentals of P2P communication by building a file-sharing app. This browser-based version serves as the perfect starting point, as its core logic can be migrated to a native **React Native** application in the future to achieve a truly cross-platform, installable app.

---

## 💻 Technology Stack

* **Client (Frontend):**
    * **React:** For building the user interface.
    * **WebRTC (`RTCPeerConnection`, `RTCDataChannel`):** The core browser API for establishing the direct P2P connection and data pipe.
    * **JavaScript `FileReader` API:** For reading the file from the user's device and splitting it into chunks.

* **Server (Signaling):**
    * **Node.js:** As the server runtime.
    * **`ws` (WebSocket) Library:** To create a simple signaling server that relays handshake messages between peers.

* **Networking Protocol:**
    * **STUN Server:** (e.g., Google's public `stun:stun.l.google.com:19302`) Used to help peers discover their public IP address and port, enabling them to bypass home/office NATs.

---

## 🛠️ How It Works (The Architecture)

The file transfer happens in two distinct phases: **Signaling** (using the server) and **Data Transfer** (directly P2P).



### Phase 1: Signaling (The "Matchmaker")

This phase uses the **WebSocket Server** to help the two browsers find and connect to each other. The server **never** sees or touches the file.

1.  **Connect:** Both peers (e.t., your Windows PC and iPhone) open the React app in their browser. Both browsers establish a WebSocket connection to the central Node.js server.
2.  **Offer:** Peer A (the initiator) creates a WebRTC **Offer** (a text block describing its connection info) and sends it to the server.
3.  **Relay:** The server relays this Offer to Peer B.
4.  **Answer:** Peer B receives the Offer, creates an **Answer** (a text block agreeing to the connection), and sends it back to the server.
5.  **Relay:** The server relays the Answer back to Peer A.
6.  **ICE Candidates:** During this process, both peers use a **STUN server** to discover their public network addresses (called **ICE Candidates**). They exchange these candidates via the WebSocket server.

### Phase 2: Direct Connection & File Transfer (P2P)

Once signaling is complete, the peers have enough information to connect directly.

1.  **P2P Link:** A direct, encrypted `RTCPeerConnection` is established between Peer A and Peer B. The WebSocket server is no longer involved.
2.  **Data Channel:** An `RTCDataChannel` (a P2P data pipe) is opened over this connection.
3.  **Metadata:** The sender sends a JSON message with file metadata (e.g., `name`, `size`, `type`).
4.  **Chunking:** The sender reads the file and splits it into small **chunks** (e.g., 64KB).
5.  **Transmission:** The sender sends the chunks one by one over the data channel. It uses **flow control** (checking `dataChannel.bufferedAmount`) to avoid overflowing the buffer and crashing the connection.
6.  **Reassembly:** The receiver collects all the binary chunks in an array.
7.  **Download:** Once all chunks are received, the receiver combines them into a single `Blob` and triggers a browser download for the user.

---

## 🚀 Getting Started

### Prerequisites

* [Node.js](https://nodejs.org/) (which includes `npm`)

### 1. Run the Signaling Server

1.  Clone the repository and `cd` into the `server` directory.
2.  Install dependencies:
    ```bash
    npm install ws
    ```
3.  Start the server:
    ```bash
    node server.js
    ```
    You should see: `Signaling server running on ws://localhost:8080`

### 2. Run the React Client

1.  In a new terminal, `cd` into the `client` (or project root) directory.
2.  Install dependencies:
    ```bash
    npm install
    ```
3.  Start the React app:
    ```bash
    npm start
    ```
    This will open the app in your browser at `http://localhost:3000`.

### 3. Test the Connection

1.  Open `http://localhost:3000` in a browser tab (Peer A).
2.  Open `http://localhost:3000` in a second browser tab or on your iPhone (Peer B).
    * *Note: To test on your iPhone, you must be on the same Wi-Fi network and access your computer's local IP address (e.g., `http://192.168.1.10:3000`).*
3.  Follow the UI instructions to connect and send a file.

---

## 🗺️ Future Roadmap

This project is the foundation for a more advanced, native application.

* [ ] **Reliable Transfer:** Implement robust file chunking, flow control, and reassembly.
* [ ] **Compression:** Add a client-side library (like `pako.js`) to compress files *before* chunking to dramatically speed up transfers of non-binary files.
* [ ] **UI Improvements:** Add a file-drop zone, connection status indicators, and a real-time progress bar.
* [ ] **Migrate to React Native:**
    * Re-use the core WebRTC and file-chunking logic using `react-native-webrtc`.
    * Replace browser File APIs with `react-native-fs` for native file system access.
    * Replace React DOM (`<div>`) with React Native components (`<View>`).
    * **Implement Serverless Discovery:** Use `react-native-udp` to add **UDP Multicasting**. This will allow the app to automatically find other devices on the *same local network* without needing the WebSocket signaling server at all.
