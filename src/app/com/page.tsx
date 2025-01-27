"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import { useQuery } from "@tanstack/react-query";

interface Data {
    name: string
}

export default function Page() {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);

    const peerName = useMemo(() => {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }, []);

    // Function to fetch peer names from the server
    const getOtherPeerNames = useCallback(async (): Promise<string[]> => {
        const response = await fetch("http://localhost:9000/blockchain/peerjs/peers");
        const data = await response.json();
        return data.filter((p: string) => p !== peerName);
    }, [peerName]);

    // Set up TanStack Query to fetch peer list every second
    const { data: activePeers = [] } = useQuery({
        queryKey: ['peers'],
        queryFn: getOtherPeerNames,
        refetchInterval: 1000, // Refetch every second
    });

    // Clean up disconnected peers whenever the active peers list updates
    useEffect(() => {
        setConnectedCons(prev => {
            return prev.filter(conn => {
                // Keep the connection if:
                // 1. It's still in the active peers list
                // 2. The connection is still open
                const isPeerActive = activePeers.includes(conn.peer);
                const isConnectionOpen = conn.open;
                
                if (!isPeerActive || !isConnectionOpen) {
                    console.log(`Removing disconnected peer: ${conn.peer}`);
                    conn.close(); // Clean up the connection
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
        });

        peer.on("open", () => {
            loadConnections();
        });

        async function loadConnections() {
            const initialOtherPeerNames = await getOtherPeerNames();
            initialOtherPeerNames.forEach((otherPeerName) => {
                const conn = peer.connect(otherPeerName);
                conn.on("open", () => {
                    conn.send("hello");
                    console.log(`connected to ${otherPeerName}`);
                    addConnection(conn);
                });
            });
        }

        return peer;
    }, [peerName, addConnection, getOtherPeerNames]);

    useEffect(() => {
        peer.on("connection", (conn) => {
            conn.on("open", () => {
                addConnection(conn);
            });
            conn.on("data", (data) => {
                console.log("received data", data);
            });
        });
    }, [peer, addConnection]);

    function sendToAll() {
        console.log(`sending to all ${connectedCons.length} connections`);
        connectedCons.forEach((conn) => {
            if (conn.open) {
                const data: Data = {
                    name: "cool name"
                };
                conn.send(data);
            } else {
                console.warn("Connection is not open:", conn);
            }
        });
    }
    
    return (
        <div>
            <p>Peer id: {peer.id}</p>
            <Button onClick={sendToAll}>Send To All</Button>
            <h1>Active connections: {connectedCons.length}</h1>
            {connectedCons.map((conn, index) => (
                <div key={index}>
                    <p>{conn.peer}</p>
                </div>
            ))}
        </div>
    );
}