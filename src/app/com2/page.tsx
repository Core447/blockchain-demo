"use client";

import { useEffect, useState, useRef } from "react";
import { Connection } from "@/classes/connection";
import Peer, { DataConnection } from "peerjs";
import { Payload, PeerRequester } from "@/lib/requester";

export default function Page() {
    const [peer, setPeer] = useState<Peer | null>(null);
    const [peerName, setPeerName] = useState<string>("");
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);
    const [rrHandlers, setRRHandlers] = useState<Map<string, (payload: Payload) => Payload>>(new Map());
    const [requesters, setRequesters] = useState<Map<string, PeerRequester>>(new Map());
    
    // Use a ref to store the connection instance to prevent recreation
    const connectionRef = useRef<Connection | null>(null);

    useEffect(() => {
        // Only create a new connection if we don't have one yet
        if (!connectionRef.current) {
            connectionRef.current = new Connection(
                (connectedCons: DataConnection[]) => setConnectedCons(connectedCons),
                (peerName: string) => setPeerName(peerName),
                (peer: Peer) => setPeer(peer),
                (rrHandlers: Map<string, (payload: Payload) => Payload>) => setRRHandlers(rrHandlers),
                (requesters: Map<string, PeerRequester>) => setRequesters(requesters),
            );
            connectionRef.current.load();
        }

        // Cleanup function to destroy the connection when the component unmounts
        return () => {
            if (connectionRef.current) {
                connectionRef.current.destroy();
                connectionRef.current = null;
            }
        };
    }, []);

    return (
        <div className="p-4 space-y-4">
            <div className="bg-gray-100 p-4 rounded-md">
                <h2 className="text-lg font-bold mb-2">Instance 2</h2>
                <p>Peer ID: <span className="font-mono">{peer?.id || "Connecting..."}</span></p>
                <p>Connected Peers: {connectedCons.length}</p>
                <ul className="mt-2 space-y-1">
                    {connectedCons.map((conn, i) => (
                        <li key={i} className="font-mono text-sm">{conn.peer}</li>
                    ))}
                </ul>
            </div>
        </div>
    );
}