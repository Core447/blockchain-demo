"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import { useQuery } from "@tanstack/react-query";

interface Data {
}

interface Message extends Data {
    message: string;
}

interface Packet {
    sender: string;
    receivers: string[];
    type: string;
    data: Data;
}

export default function Page() {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);
    const [receivedPackages, setReceivedPackages] = useState<Packet[]>([]);
    // Use a ref to track which connections we've already set up listeners for
    const handledConnections = useRef(new Set<string>());

    const peerName = useMemo(() => {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }, []);

    const getOtherPeerNames = async (): Promise<string[]> => {
        const response = await fetch("http://localhost:9000/blockchain/peerjs/peers");
        const data = await response.json();
        return data.filter((p: string) => p !== peerName);
    };

    const { data: activePeers = [] } = useQuery({
        queryKey: ['peers'],
        queryFn: getOtherPeerNames,
        refetchInterval: 1000,
    });

    const setupConnectionHandlers = useCallback((conn: DataConnection) => {
        // Check if we've already set up handlers for this connection
        if (handledConnections.current.has(conn.peer)) {
            return;
        }

        // Mark this connection as handled
        handledConnections.current.add(conn.peer);

        conn.on("open", () => {
            console.log(`Connection opened with ${conn.peer}`);
            addConnection(conn);
        });

        conn.on("data", (data) => {
            console.log(`Received data from ${conn.peer}:`, data);
            setReceivedPackages(prev => [...prev, data as Packet]);
        });

        conn.on("close", () => {
            console.log(`Connection closed with ${conn.peer}`);
            handledConnections.current.delete(conn.peer);
            setConnectedCons(prev => prev.filter(c => c.peer !== conn.peer));
        });

        conn.on("error", (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
            handledConnections.current.delete(conn.peer);
            setConnectedCons(prev => prev.filter(c => c.peer !== conn.peer));
        });
    }, []);

    useEffect(() => {
        setConnectedCons(prev => {
            return prev.filter(conn => {
                const isPeerActive = activePeers.includes(conn.peer);
                const isConnectionOpen = conn.open;
                
                if (!isPeerActive || !isConnectionOpen) {
                    console.log(`Removing disconnected peer: ${conn.peer}`);
                    handledConnections.current.delete(conn.peer);
                    conn.close();
                    return false;
                }
                return true;
            });
        });
    }, [activePeers]);

    const addConnection = useCallback((conn: DataConnection) => {
        setConnectedCons(prev => {
            const exists = prev.some(c => c.peer === conn.peer);
            if (exists) return prev;
            return [...prev, conn];
        });
    }, []);

    const peer = useMemo(() => {
        const peer = new Peer(peerName, {
            host: "localhost",
            port: 9000,
            path: "/blockchain",
            debug: 3,
        });

        peer.on("open", () => {
            console.log(`Peer opened with ID: ${peer.id}`);
            loadConnections();
        });

        peer.on("error", (err) => {
            console.error("Peer error:", err);
        });

        peer.on("disconnected", () => {
            console.log("Peer disconnected. Attempting to reconnect...");
            peer.reconnect();
        });

        async function loadConnections() {
            const initialOtherPeerNames = await getOtherPeerNames();
            initialOtherPeerNames.forEach((otherPeerName) => {
                // Only create a connection if we haven't handled it yet
                if (!handledConnections.current.has(otherPeerName)) {
                    const conn = peer.connect(otherPeerName, {
                        reliable: true,
                    });
                    setupConnectionHandlers(conn);
                }
            });
        }

        return peer;
    }, [peerName, setupConnectionHandlers]);

    // Set up the connection listener only once
    useEffect(() => {
        const connectionHandler = (conn: DataConnection) => {
            setupConnectionHandlers(conn);
        };

        peer.on("connection", connectionHandler);

        return () => {
            peer.off("connection", connectionHandler);
            // Clean up all connections when component unmounts
            handledConnections.current.clear();
        };
    }, [peer, setupConnectionHandlers]);

    function sendToAll() {
        console.log(`sending to all ${connectedCons.length} connections`);
        connectedCons.forEach((conn) => {
            if (conn.open) {
                const message: Message = {
                    message: "hello world"
                }
                const packet: Packet = {
                    type: "message",
                    data: message,
                    sender: peer.id,
                    receivers: [conn.peer]
                }
                try {
                    conn.send(packet);
                    console.log(`Sent data to ${conn.peer}`);
                } catch (error) {
                    console.error(`Error sending to ${conn.peer}:`, error);
                }
            } else {
                console.warn("Connection is not open:", conn);
            }
        });
    }
    
    return (
        <div className="p-4">
            <p className="mb-4">Peer id: {peer.id}</p>
            <Button onClick={sendToAll} className="mb-4">Send To All</Button>
            
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h1 className="text-xl font-bold mb-2">Active connections: {connectedCons.length}</h1>
                    {connectedCons.map((conn, index) => (
                        <div key={index} className="p-2 border rounded mb-2">
                            <p>{conn.peer} (Status: {conn.open ? 'Open' : 'Closed'})</p>
                        </div>
                    ))}
                </div>
                
                <div>
                    <h1 className="text-xl font-bold mb-2">Received Messages</h1>
                    {receivedPackages.slice(-5).map((msg, index) => (
                        <div key={index} className="p-2 border rounded mb-2">
                            <p>From: {msg.sender}</p>
                            <p>Message: {JSON.stringify(msg)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}