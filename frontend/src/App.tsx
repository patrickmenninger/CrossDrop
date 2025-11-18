// src/App.tsx
import { useEffect, useState, useRef } from 'react';
import { initConnection, createOffer, sendFile } from './connection/webrtc';
import FilePreview from './components/FilePreview';

export interface ReceivedFile {
    name: string;
    size: number;
    url: string;
}

function App() {
  const [receivedFile, setReceivedFile] = useState<ReceivedFile>();
  const [clients, setClients] = useState<{ you: string; clients: string[] } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Called when data is received over the data channel
  const handleDataReceived = (file: ReceivedFile) => {
    setReceivedFile(file);
  };

  const handleNoPairFound = () => {
    alert("No valid ICE candidate pair was found. Please try reconnecting.");
  };

  // Called when the signaling server sends us the list of clients
  const handleClientsReceived = (payload: { you: string; clients: string[] }) => {
    console.log("Clients update:", payload);
    setClients(payload);
  };

  // Initialize WebRTC + signaling once when component mounts
  useEffect(() => {
    initConnection(handleDataReceived, handleClientsReceived, handleNoPairFound);
  }, []);

  // Send the selected file over the data channel
  const handleSendFileClick = () => {
    const file = fileInputRef.current?.files?.[0];
    if (file) sendFile(file);
  };

  // Create offer to the selected client
  const handleStartConnection = (clientId: string) => {
    if (!clientId) {
      alert("Please select a client to connect to first!");
      return;
    }
    createOffer(handleDataReceived, clientId);
  };

  return (
    <div className="App" style={{ padding: '20px' }}>
      <h1>WebRTC File Share</h1>
      <p>
        Open this page in two tabs or browsers. Wait for both to appear in the client list,
        then select one and start a connection.
      </p>

      <hr />

      {/* Clients Section */}
      <h3>Connected Clients</h3>
      {!clients ? (
        <p>Connecting to signaling server...</p>
      ) : (
        <div>
          <p><strong>Your ID:</strong> {clients.you}</p>
          {clients.clients.length === 0 ? (
            <p>No other clients connected.</p>
          ) : (
            <ul>
              {clients.clients.map((clientId) => (
                <li key={clientId}>
                  <label>
                    <input
                      type="radio"
                      name="targetClient"
                      value={clientId}
                      onChange={() => handleStartConnection(clientId)}
                    />
                    {clientId}
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* <button onClick={handleStartConnection} disabled={!selectedClient}>
        1 Start Connection
      </button> */}

      <hr />

      <input type="file" ref={fileInputRef} />
      <button onClick={handleSendFileClick}>
        2 Send File
      </button>

      <hr />

        {/* Received Files Section */}
      <h3>Received Files:</h3>
      {!receivedFile ? (
        <p>No files received yet.</p>
      ) : (
        <FilePreview file={receivedFile}/>
      )}
    </div>
  );
}

export default App;
