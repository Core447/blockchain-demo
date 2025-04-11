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

    const connection = useMemo(() => {
        const connection = new Connection(
            (connectedCons: DataConnection[]) => setConnectedCons(connectedCons),
            (peerName: string) => { },
            (peer: Peer) => setPeer(peer),
            (rrHandlers: Map<string, (payload: Payload) => Payload>) => setRRHandlers(rrHandlers),
            (requesters: Map<string, PeerRequester>) => setRequesters(requesters),
        );
        connection.load();
        return connection;
    }, []);

    // const { data: activePeers = [] } = useQuery({
    //     queryKey: ['updateConnections'],
    //     queryFn: connection.updateConnections,
    //     refetchInterval: 1000,
    // });

    const peerName = useMemo(() => {
        if (!peer) {
            return "";
        }
        return peer.id;
    }, [peer]);


    const addDataHandler = useCallback((handler: (packet: Packet) => void) => {
        connection.addDataHandler(handler);
    }, [connection]);

    const addRRHandler = useCallback((payloadType: string, handler: (payload: Payload) => Payload) => {
        connection.addRRHandler(payloadType, handler);
    }, [connection]);

    const sendRRMessage = useCallback(async <TRequest, TResponse>(peerName: string, payload: TRequest): Promise<TResponse> => {
        return connection.sendRRMessage<TRequest, TResponse>(peerName, payload);
    }, [connection]);


    return (
        <ConnectionContext.Provider value={{
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