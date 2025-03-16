"use client";

import { Packet } from "@/app/com/page";
import { RequestOtherPublicKey } from "@/lib/messages";
import { RRMessage, Payload, PeerRequester } from "@/lib/requester";
import { useQuery } from "@tanstack/react-query";
import Peer, { DataConnection } from "peerjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";

type ConnectionContextType = {
    peer: Peer | undefined;
    connectedCons: DataConnection[];
    connectedConsRef: React.MutableRefObject<DataConnection[]>;
    peerName: string;
    addDataHandler: (handler: (packet: Packet) => void) => void;
    requesters: Map<string, PeerRequester>;
    requestersRef: React.MutableRefObject<Map<string, PeerRequester>>;
    requestersState: Map<string, PeerRequester>;
    RRHandlers: Map<string, (payload: Payload) => void>;
    addRRHandler: (payloadType: string, handler: (payload: Payload) => Payload) => void;
    sendRRMessage<TRequest, TResponse>(peerName: string, payload: TRequest): Promise<TResponse>;
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
    const connectedConsRef = useRef<DataConnection[]>([]);
    // Use a ref to track which connections we've already set up listeners for
    const handledConnections = useRef(new Set<string>());
    const dataHandlers = useRef<((packet: Packet) => void)[]>([]);
    const RRHandlers = useRef<Map<string, ((payload: Payload<unknown>) => Payload<unknown>)>>(new Map());

    const requesters = useRef<Map<string, PeerRequester>>(new Map());
    const [requestersState, setRequestersState] = useState<Map<string, PeerRequester>>(new Map());
    
    // Ref to store the Peer instance
    const peerRef = useRef<Peer | null>(null);
    
    function addDataHandler(handler: (packet: Packet) => void) {
        dataHandlers.current.push(handler);
    }

    function addRRHandler(payloadType: string, handler: (payload: Payload) => Payload) {
        RRHandlers.current.set(payloadType, handler);
    }

    const peerName = useMemo(() => {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }, []);

    const getOtherPeerNames = useCallback(async (): Promise<string[]> => {
        const response = await fetch(`http://localhost:9000/blockchain/peerjs/peers`);
        const data = await response.json();
        return data.filter((p: string) => p !== peerName);
    }, [peerName]);

    const { data: activePeers = [] } = useQuery({
        queryKey: ['peers'],
        queryFn: getOtherPeerNames,
        refetchInterval: 1000,
    });

    const addConnection = useCallback((conn: DataConnection) => {
        connectedConsRef.current.push(conn);
        setConnectedCons(prev => {
            const exists = prev.some(c => c.peer === conn.peer);
            if (exists) return prev;
            return [...prev, conn];
        });
    }, []);

    async function sendRRMessage<TRequest, TResponse>(peerName: string, payload: TRequest): Promise<TResponse> {
        const requester = requesters.current.get(peerName);
        if (requester) {
            const response = await requester.request<TRequest, TResponse>(payload);
            return response;
        }
        throw new Error(`No connection to ${peerName}`);
    }

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
                // find handler
                console.log("Received request", payload);
                const handler = RRHandlers.current.get(payload.type);
                if (handler) {
                    return handler(payload);
                }
                console.error("No handler found for", payload.type);
                throw new Error(`No handler for ${payload.type}`);
            })
            console.log("bbc adding requester")
            requesters.current.set(conn.peer, requester);
            setRequestersState(requesters.current);
            console.log("bbc n", requesters.current.size)
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
            connectedConsRef.current = connectedConsRef.current.filter(c => c.peer !== conn.peer);
            // Remove the requesters for this connection
            requesters.current.delete(conn.peer);
            setRequestersState(requesters.current);
        });

        conn.on("error", (err) => {
            console.error(`Connection error with ${conn.peer}:`, err);
            handledConnections.current.delete(conn.peer);
            setConnectedCons(prev => prev.filter(c => c.peer !== conn.peer));
            connectedConsRef.current = connectedConsRef.current.filter(c => c.peer !== conn.peer);
        });

    }, []);

    // Use useMemo with peerRef to prevent duplicate peer creation
    const peer = useMemo(() => {
        if (typeof window === 'undefined') return;
        
        // Return existing peer if already created with the same name
        if (peerRef.current && peerRef.current.id === peerName) {
            console.log("Reusing existing peer instance", peerName);
            return peerRef.current;
        }
        
        console.log("Creating new peer", "peerName: ", peerName);
        const newPeer = new Peer(peerName, {
            host: "localhost",
            port: 9000,
            path: "/blockchain",
            debug: 3,
            secure: false
        });

        newPeer.on("open", () => {
            console.log(`Peer opened with ID: ${newPeer.id}`);
        });

        newPeer.on("error", (err) => {
            console.error("Peer error:", err);
        });

        newPeer.on("disconnected", () => {
            console.log("Peer disconnected. Attempting to reconnect...");
            newPeer.reconnect();
        });
        
        // Store the peer instance in the ref
        peerRef.current = newPeer;
        return newPeer;
    }, [peerName]);

    // Load initial connections after component is mounted
    useEffect(() => {
        if (!peer) return;
        
        async function loadConnections() {
            try {
                const initialOtherPeerNames = await getOtherPeerNames();
                initialOtherPeerNames.forEach((otherPeerName) => {
                    // Only create a connection if we haven't handled it yet
                    if (!handledConnections.current.has(otherPeerName)) {
                        const conn = peer!.connect(otherPeerName, {
                            reliable: true,
                        });
                        setupConnectionHandlers(conn);
                    }
                });
            } catch (error) {
                console.error("Error loading connections:", error);
            }
        }
        
        // Only load connections after peer is open
        if (peer.open) {
            loadConnections();
        } else {
            peer.on("open", loadConnections);
        }
        
        return () => {
            peer.off("open", loadConnections);
        };
    }, [peer, getOtherPeerNames, setupConnectionHandlers]);

    // Set up the connection listener only once
    useEffect(() => {
        if (!peer) return;
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
        <ConnectionContext.Provider value={{ peer, connectedCons, peerName, addDataHandler, requesters: requesters.current, RRHandlers: RRHandlers.current, addRRHandler, sendRRMessage, connectedConsRef, requestersRef: requesters, requestersState }}>
            {children}
        </ConnectionContext.Provider>
    );
}