'use client';

import { useEffect, useState } from 'react';
import { Peer } from 'peerjs';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Share2 } from 'lucide-react';

const PEER_IDS = {
  firefox: 'firefox-browser',
  chrome: 'chrome-browser'
};

export default function Home() {
  const [peer, setPeer] = useState<Peer | null>(null);
  const [connection, setConnection] = useState<any>(null);
  const [status, setStatus] = useState<string>('Initializing...');
  const [messages, setMessages] = useState<string[]>([]);
  const [browserType, setBrowserType] = useState<'firefox' | 'chrome'>('chrome');

  useEffect(() => {
    // Detect browser type
    const isFirefox = navigator.userAgent.toLowerCase().includes('firefox');
    const currentBrowser = isFirefox ? 'firefox' : 'chrome';
    setBrowserType(currentBrowser);

    // Create peer with fixed ID based on browser type
    const newPeer = new Peer(PEER_IDS[currentBrowser]);

    newPeer.on('open', () => {
      setStatus('Connected to signaling server');
      
      // If Chrome, connect to Firefox
      if (currentBrowser === 'chrome') {
        const conn = newPeer.connect(PEER_IDS.firefox);
        handleConnection(conn);
      }
    });

    newPeer.on('connection', (conn) => {
      handleConnection(conn);
    });

    newPeer.on('error', (err) => {
      console.error('Peer error:', err);
      setStatus(`Error: ${err.type}`);
    });

    setPeer(newPeer);

    return () => {
      newPeer.destroy();
    };
  }, []);

  const handleConnection = (conn: any) => {
    setConnection(conn);
    setStatus('Peer connection established');

    conn.on('open', () => {
      setStatus('Ready to exchange messages');
    });

    conn.on('data', (data: string) => {
      setMessages((prev) => [...prev, `Received: ${data}`]);
    });

    conn.on('close', () => {
      setStatus('Connection closed');
      setConnection(null);
    });
  };

  const sendMessage = () => {
    if (connection) {
      const message = `Hello from ${browserType} at ${new Date().toLocaleTimeString()}`;
      connection.send(message);
      setMessages((prev) => [...prev, `Sent: ${message}`]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-8">Browser P2P Connection</h1>
        
        <Card className="p-6 bg-gray-800 border-gray-700">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">Your Browser: {browserType}</h2>
                <p className="text-sm text-gray-400">Using fixed peer ID: {PEER_IDS[browserType]}</p>
              </div>
              <Badge variant="secondary" className="text-sm">
                {status}
                {status === 'Initializing...' && (
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                )}
              </Badge>
            </div>

            <div className="space-y-2">
              {connection && (
                <button
                  onClick={sendMessage}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                >
                  <Share2 className="h-4 w-4" />
                  Send Test Message
                </button>
              )}

              <div className="mt-4 space-y-2">
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className="p-2 rounded bg-gray-700 text-sm"
                  >
                    {message}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}