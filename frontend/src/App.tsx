// src/App.js
import { useEffect, useState, useRef, type Ref } from 'react';
import { initConnection, createOffer, sendFile } from './connection/webrtc.ts';

function App() {
  const [receivedMessages, setReceivedMessages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Callback to update our state when data arrives
  const handleDataReceived = (data: string) => {
    setReceivedMessages(prev => [...prev, data]);
  };

  // On component mount, initialize the connection
  useEffect(() => {
    initConnection(handleDataReceived);
  }, []);

  // Handler for the file input button
  const handleSendFileClick = () => {
    const file = fileInputRef.current?.files;
    if (file && file.length !== 0) {
      sendFile(file[0]);
    }
  };

  return (
    <div className="App" style={{ padding: '20px' }}>
      <h1>WebRTC Skeleton</h1>
      <p>Instructions: Open this in two tabs. Click '1. Start Connection' in Tab A. Then you can send files from either tab.</p>
      
      <hr />

      {/* This button is for Peer A (the initiator) */}
      <button onClick={() => createOffer(handleDataReceived)}>
        1. Start Connection (Peer A)
      </button>

      <hr />

      <input type="file" ref={fileInputRef} />
      <button onClick={handleSendFileClick}>
        2. Send File
      </button>

      <hr />

      <h3>Received Messages/Files:</h3>
      <ul>
        {receivedMessages.map((msg, index) => (
          <li key={index}>{msg}</li>
        ))}
      </ul>
    </div>
  );
}

export default App;