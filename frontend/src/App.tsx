// src/App.tsx
import { useEffect, useState, useRef } from 'react';
import { initConnection, createOffer, closeConnection } from './connection/webrtc';
// import FilePreview from './components/FilePreview';
import NetworkNode from './components/NetworkNode';
import ConnectionArc from './components/ConnectionArc';

export interface ReceivedFile {
    name: string;
    size: number;
    url: string;
}

export interface ClientInfo {
    id: string;
    name: string
}

function App() {
  const [receivedFile, setReceivedFile] = useState<ReceivedFile>();
  console.log(receivedFile)
  const [clients, setClients] = useState<{ you: ClientInfo; clients: ClientInfo[] } | null>(null);
  // Store randomized positions for client nodes
  const [clientPositions, setClientPositions] = useState<{ id: string; x: number; y: number }[]>([]);
  // Connection status: { [clientId]: 'connected' | 'connecting' | 'failed' | 'disconnected' }
  const [connectionStatus, setConnectionStatus] = useState<{ [clientId: string]: 'connected' | 'connecting' | 'failed' | 'disconnected' }>({});
  // Currently selected client for connection
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  // Animation state for connecting lines
  const [animationTick, setAnimationTick] = useState(0);

//   const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedClientIdRef = useRef<string | null>(null);
    useEffect(() => {
        selectedClientIdRef.current = selectedClientId;
    }, [selectedClientId]);

  // Called when data is received over the data channel
  const handleDataReceived = (file: ReceivedFile) => {
    setReceivedFile(file);
  };

  // Called when the signaling server sends us the list of clients
  const handleClientsReceived = (payload: { you: ClientInfo; clients: ClientInfo[] }) => {
    console.log("Clients update:", payload);
    setClients(payload);

    // Only re-randomize positions if the number of clients changes
    if (payload.clients.length > 0) {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - 100;
      const nodeRadius = 60;
      const minDist = nodeRadius * 2 + 10;
      const positions: { id: string; x: number; y: number }[] = clientPositions;
      let attempts = 0;
      for (let i = 0; i < payload.clients.length; i++) {
        let placed = false;

        if (positions.find(p => p.id === payload.clients[i].id)) {
          continue; // already placed
        }

        while (!placed && attempts < 1000) {
          attempts++;
          // Random angle and distance
          const angle = Math.random() * 2 * Math.PI;
          const dist = radius * (0.7 + 0.3 * Math.random());
          const x = centerX + dist * Math.cos(angle);
          const y = centerY + dist * Math.sin(angle);
          // Collision detection
          let collision = false;
          for (const pos of positions) {
            const dx = pos.x - x;
            const dy = pos.y - y;
            if (Math.sqrt(dx * dx + dy * dy) < minDist) {
              collision = true;
              break;
            }
          }
          if (!collision) {
            positions.push({ id: payload.clients[i].id, x, y });
            placed = true;
          }
        }
      }
      setClientPositions(positions);
    } else {
      setClientPositions([]);
    }
  };

  // Initialize WebRTC + signaling once when component mounts
  useEffect(() => {
    initConnection(handleClientsReceived, handleConnectionStatusChange, handleDataReceived);
  }, []);

  // Animation loop for connection lines/arcs: run as long as a client is selected
  useEffect(() => {
    let frame: number;
    const animate = () => {
      setAnimationTick(tick => tick + 1);
      frame = requestAnimationFrame(animate);
    };
    if (selectedClientId) {
      frame = requestAnimationFrame(animate);
      return () => cancelAnimationFrame(frame);
    }
    return () => {};
  }, [selectedClientId, connectionStatus]);

  // Send the selected file over the data channel
//   const handleSendFileClick = () => {
//     const file = fileInputRef.current?.files?.[0];
//     if (file) sendFile(file);
//   };

  useEffect(() => {
    console.log("Connection status updated:", connectionStatus);
  }, [connectionStatus]);
  
  const handleConnectionStatusChange = (status: 'connected' | 'connecting' | 'failed', clientId: string) => {
    setConnectionStatus((prev) => ({ ...prev, [clientId as string]: status }));
  }

  // Create offer to the selected client
  const handleStartConnection = (clientId: string) => {
    if (!clientId) {
      alert("Please select a client to connect to first!");
      return;
    }
    closeConnection(); // Terminate any previous connection
    setConnectionStatus((prev) => ({ ...prev, [clientId]: 'disconnected' }));
    setSelectedClientId(clientId);
    createOffer(handleDataReceived, clientId, handleConnectionStatusChange);
  };

  return (
    <div className="w-screen h-screen m-0 p-0 overflow-hidden relative bg-slate-50">
      {/* Fullscreen SVG network area */}
      <svg
        width="100vw"
        height="100vh"
        viewBox={`0 0 ${window.innerWidth} ${window.innerHeight}`}
        className="absolute top-0 left-0 w-screen h-screen z-0"
      >
        {/* Central node for 'You' */}
        <NetworkNode
          x={window.innerWidth / 2}
          y={window.innerHeight / 2}
          name={clients?.you?.name ? clients.you.name + ' (You)' : 'You'}
          color="#4f8cff"
          stroke="#fff"
          strokeWidth={6}
          isYou
          fontSize={(() => {
            const name = clients?.you?.name ? clients.you.name + ' (You)' : 'You';
            const baseFont = 10;
            const minFont = 10;
            const maxChars = 18;
            return Math.max(minFont, Math.min(baseFont, Math.floor(baseFont * (maxChars / Math.max(name.length, 1)))));
          })()}
        />

        {/* Render client nodes as circles with names */}
        {clientPositions.map((pos) => {
          const client = clients?.clients.find(c => c.id === pos.id);
          if (!client) return null;
          const baseFont = 10;
          const minFont = 10;
          const maxChars = 18;
          const fontSize = Math.max(minFont, Math.min(baseFont, Math.floor(baseFont * (maxChars / Math.max(client.name.length, 1)))));
          return (
            <NetworkNode
              key={client.id}
              x={pos.x}
              y={pos.y}
              name={client.name}
              color="#00008B"
              stroke="#fff"
              strokeWidth={4}
              fontSize={fontSize}
              onClick={() => handleStartConnection(client.id)}
            />
          );
        })}

        {/* Render connection lines/arcs based on connectionStatus (drawn on top) */}
        {selectedClientId && (() => {
          const youX = window.innerWidth / 2;
          const youY = window.innerHeight / 2;
          const clientPos = clientPositions.find(p => p.id === selectedClientId);
          if (!clientPos) return null;
          const status = connectionStatus[selectedClientId];
          if (status === 'connecting') {
            const n = 4;
            return (
              <g>
                {Array.from({ length: n }).map((_, i) => (
                  <ConnectionArc
                    key={i}
                    youX={youX}
                    youY={youY}
                    clientX={clientPos.x}
                    clientY={clientPos.y}
                    status={status}
                    animationTick={animationTick}
                    arcIndex={i}
                    totalArcs={n}
                  />
                ))}
              </g>
            );
          } else {
            return (
              <ConnectionArc
                youX={youX}
                youY={youY}
                clientX={clientPos.x}
                clientY={clientPos.y}
                status={status}
                animationTick={animationTick}
              />
            );
          }
        })()}

        {/* SVG filter for glow effect */}
        <filter id="glow">
          <feGaussianBlur stdDeviation="12" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </svg>

      {/* Overlay UI (file input, received files, etc.) */}
      {/* <div className="absolute top-0 left-0 w-screen z-10 pointer-events-none">
        <div className="max-w-xl mx-auto mt-8 bg-white/95 rounded-2xl shadow-lg p-6 pointer-events-auto">
          <h1 className="text-2xl font-bold mb-2">WebRTC File Share</h1>
          <p className="mb-2">
            Open this page in two tabs or browsers. Wait for both to appear in the client list,
            then select one and start a connection.
          </p>
          <hr className="my-2" />
          <h3 className="text-lg font-semibold mb-2">Connected Clients</h3>
          {pairError && <p className="text-red-600 whitespace-pre-wrap">{pairError}</p>}
        </div>
      </div> */}

      {/* File input and received files UI at the bottom */}
      {/* <div className="absolute bottom-0 left-0 w-screen z-10 pointer-events-none">
        <div className="max-w-xl mx-auto mb-8 bg-white/95 rounded-2xl shadow-lg p-6 pointer-events-auto flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <input type="file" ref={fileInputRef} className="flex-1" />
            <button onClick={handleSendFileClick} className="ml-2 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition">
              2 Send File
            </button>
          </div>
          <hr className="my-2" />
          <h3 className="text-lg font-semibold mb-2">Received Files:</h3>
          {!receivedFile ? (
            <p>No files received yet.</p>
          ) : (
            <FilePreview file={receivedFile}/>
          )}
        </div>
      </div> */}
    </div>
  );
}

export default App;
