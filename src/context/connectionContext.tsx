"use client";

import { Packet } from "@/app/com/page";
import { RequestOtherPublicKey } from "@/lib/messages";
import { RRMessage, Payload, PeerRequester } from "@/lib/requester";
import { useQuery } from "@tanstack/react-query";
import Peer, { DataConnection } from "peerjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";

type ConnectionContextType = {
    peer: Peer;
    connectedCons: DataConnection[];
    peerName: string;
    addDataHandler: (handler: (packet: Packet) => void) => void;
    requesters: Map<string, PeerRequester>;
}

const ConnectionContext = createContext<ConnectionContextType | null>(null);

export const useConnectionContext = () => {
    const context = useContext(ConnectionContext);
    if (!context) {
        throw new Error("useConnectionContext must be used within a ConnectionProvider");
    }
    return context;
}

export const ConnectionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);
    // Use a ref to track which connections we've already set up listeners for
    const handledConnections = useRef(new Set<string>());
    // const [dataHandlers, setDataHandlers] = useState<((packet: Packet) => void)[]>([]);
    const dataHandlers = useRef<((packet: Packet) => void)[]>([]);

    const requesters = useRef<Map<string, PeerRequester>>(new Map());

    

    function addDataHandler(handler: (packet: Packet) => void) {
        // setDataHandlers(prev => [...prev, handler]);
        dataHandlers.current.push(handler);
    }

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

    const addConnection = useCallback((conn: DataConnection) => {
        setConnectedCons(prev => {
            const exists = prev.some(c => c.peer === conn.peer);
            if (exists) return prev;
            return [...prev, conn];
        });
    }, []);

    const setupConnectionHandlers = useCallback((conn: DataConnection) => {
        // Check if we've already set up handlers for this connection
        if (handledConnections.current.has(conn.peer)) {
            return;
        }

        // Mark this connection as handled
        handledConnections.current.add(conn.peer);

        conn.on("open", () => {
            console.log(`Connection opened with ${conn.peer}`);
            const requester = new PeerRequester(conn);
            requester.onRequest<Payload, Payload>((payload) => {
                if (payload.type === "requestOtherPublicKey") {
                    const data: RequestOtherPublicKey = payload.payload;
                    const response: Payload = {
                        type: "returnOtherPublicKey",
                        payload: "this is the other public key"
                    }
                    return response
                }
            })
            requesters.current.set(conn.peer, requester);
            addConnection(conn);
        });

        conn.on("data", (data) => {
            console.log(`Received data from ${conn.peer}:`, data);
            const receivedPacket = data as Packet;
            console.log("Calling handlers", dataHandlers.current.length);
            dataHandlers.current.forEach((handler) => handler(receivedPacket));
        });

        conn.on("close", () => {
            console.log(`Connection closed with ${conn.peer}`);
            handledConnections.current.delete(conn.peer);
            setConnectedCons(prev => prev.filter(c => c.peer !== conn.peer));
            // Remove the requesters for this connection
            requesters.current.delete(conn.peer);
        });

        conn.on("error", (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
            handledConnections.current.delete(conn.peer);
            setConnectedCons(prev => prev.filter(c => c.peer !== conn.peer));
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

    return (
        <ConnectionContext.Provider value={{ peer, connectedCons, peerName, addDataHandler, requesters: requesters.current }}>
            {children}
        </ConnectionContext.Provider>
    );
}