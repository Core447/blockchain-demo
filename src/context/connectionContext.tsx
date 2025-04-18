"use client";

import { Packet } from "@/app/com/page";
import { Connection } from "@/classes/connection";
import { RequestOtherPublicKey } from "@/lib/messages";
import { RRMessage, Payload, PeerRequester } from "@/lib/requester";
import { useQuery } from "@tanstack/react-query";
import Peer, { DataConnection } from "peerjs";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";

type ConnectionContextType = {
    connection: Connection | null;
    peer: Peer | null;
    connectedCons: DataConnection[];
    peerName: string;
    addDataHandler: (handler: (packet: Packet) => void) => void;
    requesters: Map<string, PeerRequester>;
    rrHandlers: Map<string, (payload: Payload) => void>;
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
    const [rrHandlers, setRRHandlers] = useState<Map<string, (payload: Payload) => Payload>>(new Map());
    const [requesters, setRequesters] = useState<Map<string, PeerRequester>>(new Map());
    const [peer, setPeer] = useState<Peer | null>(null);

    const pendingRRHandlers = useRef<Map<string, (payload: Payload) => Payload>>(new Map());
    const pendingDataHandlers = useRef<((packet: Packet) => void)[]>([]);
    
    // Use a ref to store the connection instance to prevent recreation
    const connectionRef = useRef<Connection | null>(null);

    // Initialize connection only once
    useEffect(() => {
        // Only create a new connection if we don't have one yet
        if (!connectionRef.current) {
            connectionRef.current = new Connection(
                (connectedCons: DataConnection[]) => setConnectedCons(connectedCons),
                (peerName: string) => { },
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

    // Use the connection from the ref
    const connection = connectionRef.current;

    const peerName = useMemo(() => {
        if (!peer) {
            return "";
        }
        return peer.id;
    }, [peer]);

    const addDataHandler = useCallback((handler: (packet: Packet) => void) => {
        if (connection) {
            console.log("Adding data handler 2");
            connection.addDataHandler(handler);
        } else {
            pendingDataHandlers.current.push(handler);
        }
        console.log("Adding data handler 3");
    }, [connection]);

    const addRRHandler = useCallback((payloadType: string, handler: (payload: Payload) => Payload) => {
        if (connection) {
            connection.addRRHandler(payloadType, handler);
        } else {
            pendingRRHandlers.current.set(payloadType, handler);
        }
    }, [connection]);

    const sendRRMessage = useCallback(async <TRequest, TResponse>(peerName: string, payload: TRequest): Promise<TResponse> => {
        if (!connection) {
            throw new Error("Connection not initialized");
        }
        return connection.sendRRMessage<TRequest, TResponse>(peerName, payload);
    }, [connection]);



    useEffect(() => {
        if (connection) {
            // Add pending data handlers
            pendingDataHandlers.current.forEach(handler => {
                console.log("Adding data handler 1");
                connection.addDataHandler(handler);
            });
            pendingDataHandlers.current = [];
            // Add pending RR handlers
            pendingRRHandlers.current.forEach((handler, payloadType) => {
                connection.addRRHandler(payloadType, handler);
            });
            pendingRRHandlers.current.clear();
        }
    }, [connection]);



    // Create a stable function reference for updateConnections
    const updateConnectionsFn = useCallback(async () => {
        if (!connectionRef.current) {
            console.warn("Connection not initialized, cannot update connections");
            return [];
        }
        await connectionRef.current.updateConnections();
        return connectionRef.current.connectedCons.map(conn => conn.peer);
    }, []);

    // Use the stable function reference in the query
    const { data: activePeers = [] } = useQuery({
        queryKey: ['updateConnections'],
        queryFn: updateConnectionsFn,
        refetchInterval: 1000,
        enabled: !!connectionRef.current, // Only run the query if we have a connection
    });

    return (
        <ConnectionContext.Provider value={{
            connection,
            peer,
            connectedCons,
            peerName,
            addDataHandler,
            requesters: requesters,
            rrHandlers,
            addRRHandler,
            sendRRMessage,
        }}>
            {children}
        </ConnectionContext.Provider>
    );
}