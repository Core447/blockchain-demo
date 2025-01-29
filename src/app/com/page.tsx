"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import { useQuery } from "@tanstack/react-query";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import { createHash } from 'crypto';
import { Slider } from "@/components/ui/slider";




interface Data {
}

interface Message extends Data {
    message: string;
}

interface Transaction extends Data {
    amount: number;
}

interface Packet {
    sender: string;
    receivers: string[];
    type: string;
    data: Data;
    proofOfWork: number | undefined;
}

export default function Page() {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);
    const [receivedPackages, setReceivedPackages] = useState<Packet[]>([]);
    // Use a ref to track which connections we've already set up listeners for
    const handledConnections = useRef(new Set<string>());

    const [leadingZeros, setLeadingZeros] = useState(4);

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

    function sendPacket(packet: Packet) {
        console.log(`Sending packet to ${packet.receivers}:`, packet);
        packet.receivers.forEach((receiver) => {
            const conn = connectedCons.find((c) => c.peer === receiver);
            if (conn) {
                try {
                    conn.send(packet);
                    console.log(`Sent packet to ${receiver}`);
                } catch (error) {
                    console.error(`Error sending to ${receiver}:`, error);
                }
            } else {
                console.warn("Connection not found for receiver:", receiver);
            }
        });
    }

    function sendCurrency(amount: number, to: string) {
        const transaction: Transaction = {
            amount: amount
        }
        sendData(transaction, "transaction", [to]);
    }

    function sendData(data: Data, type: string, to: string[], addProofOfWork?: boolean) {
        const packet: Packet = {
            type: type,
            data: data,
            sender: peer.id,
            receivers: to,
            proofOfWork: undefined
        }
        const proofOfWork = addProofOfWork ? calculateProofOfWork(packet, leadingZeros) : undefined;
        packet.proofOfWork = proofOfWork;
        sendPacket(packet);
    }

    function sendToAll() {
        console.log(`sending to all ${connectedCons.length} connections`);
        const message: Message = {
            message: "hello world"
        }
        sendData(message, "message", connectedCons.map(c => c.peer));
    }

    function sendCurrencyToEveryone() {
        console.log(`sending to all ${connectedCons.length} connections`);
        const transaction: Transaction = {
            amount: Math.round(Math.random()*1000),
        }
        sendData(transaction, "transaction", connectedCons.map(c => c.peer), true);
    }

    function calculateHashOfPacket(packet: Packet): string {
        const packetString = JSON.stringify(packet);
        const hash = createHash('sha1');
        hash.update(packetString);
        return hash.digest('hex');
    }

    function calculateProofOfWork(packet: Packet, nLeadingZeros: number): number {
        console.log(`Calculating proof of work for packet:`, packet);
        const start = performance.now();
        let tries = 0;
        let hash = calculateHashOfPacket(packet);
        while (!hash.startsWith('0'.repeat(nLeadingZeros))) {
            packet.proofOfWork = (packet.proofOfWork || 0) + 1;
            hash = calculateHashOfPacket(packet);
            tries++;
            if (tries % 1000 === 0) {
                console.log("Hashes calculated:", tries);
            }
        }
        const end = performance.now();
        console.log(`Proof of work calculated in ${tries} tries in ${(end - start)/1000}s:`, packet.proofOfWork, hash);
        return packet.proofOfWork!;
    }

    function isHashValid(hash: string, nLeadingZeros: number): boolean {
        return hash.startsWith('0'.repeat(nLeadingZeros));
    }

    
    return (
        <div className="p-4">
            <p className="mb-4">Peer id: {peer.id}</p>
            {/* <input type="number" value={leadingZeros} onChange={(e) => setLeadingZeros(parseInt(e.target.value))} className="mb-4"/> */}

            <div className="flex flex-rol gap-4">
                <Button onClick={sendToAll} className="mb-4">Send To All</Button>
                <Button onClick={sendCurrencyToEveryone} className="mb-4">Send Currency To Everyone</Button>
            </div>
            
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
                    <h1 className="text-xl font-bold mb-2">Received Packages</h1>
                    {receivedPackages.slice(-5).map((packet, index) => (
                        <div key={index} className="p-2 border rounded mb-2">
                            <p>From: {packet.sender}</p>
                            {/* <p>Message: {JSON.stringify(packet)}</p> */}
                            <JSONPretty id="json-pretty" data={packet}></JSONPretty>
                            <p>Hash: {calculateHashOfPacket(packet)}</p>
                            <p className={`${isHashValid(calculateHashOfPacket(packet), leadingZeros) ? "text-green-500" : "text-red-500"}`}>Hash as int: {calculateHashOfPacket(packet)}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}