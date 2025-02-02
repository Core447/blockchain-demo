"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import { useQuery } from "@tanstack/react-query";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import { createHash } from 'crypto';
import { calculateHashOfPacket, isHashValid } from "@/lib/hash";
import PacketUI from "./PacketUI";
import { sendData } from "@/lib/communication";
import { generateKey } from "openpgp";
import { SignedTransaction, signTransaction, Transaction, verifyTransactionSignature } from "@/lib/transactions";
import TransactionCard from "./TransactionCard";




export interface Data {
}

export interface Message extends Data {
    message: string;
}

export interface Packet {
    sender: string;
    receivers: string[];
    // alreadyBelongsToChain: boolean;
    type: string;
    data: Data;
    // proofOfWork: number | null;
    // previousHash: string | null;
}

export interface PublicKeyShare {
    publicKey: string;
}

export default function Page() {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);
    const [receivedPackages, setReceivedPackages] = useState<Packet[]>([]);
    // Use a ref to track which connections we've already set up listeners for
    const handledConnections = useRef(new Set<string>());
    const [privateKey, setPrivateKey] = useState("");
    const [publicKey, setPublicKey] = useState("");

    const publicKeysRef = useRef<Map<string, string>>(new Map());
    const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());

    const [blockchain, setBlockchain] = useState<Packet[]>([]);
    const [unverifiedPackages, setUnverifiedPackages] = useState<Packet[]>([]);

    const [leadingZeros, setLeadingZeros] = useState(4);

    const [transactions, setTransactions] = useState<SignedTransaction[]>([]);

    const peerName = useMemo(() => {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }, []);

    useEffect(() => {
        async function load() {
            const { publicKey, privateKey } = await generateKey({
                userIDs: [{ name: peerName }],
            })
            setPublicKey(publicKey);
            setPrivateKey(privateKey);
        }
        load();
    }, [peerName]);

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
            const receivedPacket = data as Packet;
            if (receivedPacket.type == "publicKeyShare") {
                const publicSharePacket = receivedPacket.data as PublicKeyShare;
                publicKeysRef.current.set(receivedPacket.sender, publicSharePacket.publicKey);
                setPublicKeys(new Map(publicKeysRef.current));
                console.log("public keys", publicKeysRef.current);
            }
            if (receivedPacket.type == "transaction") {
                // const signedTransaction = data as SignedTransaction;
                const signedTransaction = receivedPacket.data as SignedTransaction;
                const publicKeyOfSender = publicKeysRef.current.get(receivedPacket.sender);
                // signedTransaction.transaction.amount = 1000;
                setTransactions(prev => [...prev, signedTransaction]);




                console.log("public key of sender", publicKeyOfSender);
                console.log("we have the public keys of ", publicKeys);
                if (!publicKeyOfSender) {
                    console.error(`Public key of sender "${receivedPacket.sender}" not found`);
                    return;
                }
                verifyTransactionSignature(signedTransaction, publicKeyOfSender).then((result) => {
                    if (result) {
                        console.log("Transaction is valid");
                    } else {
                        console.error("Transaction is not valid");
                    }
                })
            }
            // if (receivedPacket.alreadyBelongsToChain) {
            //     setBlockchain(prev => [...prev, receivedPacket]);
            // } else {
            //     setUnverifiedPackages(prev => [...prev, receivedPacket]);
            // }
            // setReceivedPackages(prev => [...prev, data as Packet]);
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

    

    // function sendCurrency(amount: number, to: string) {
    //     const transaction: Transaction = {
    //         amount: amount
    //     }
    //     sendData(transaction, "transaction", [to]);
    // }

    function broadcastPublicKey() {
        const data: PublicKeyShare = {
            publicKey: publicKey
        }
        sendData(peer, connectedCons, setUnverifiedPackages, data, "publicKeyShare", connectedCons.map(c => c.peer));
    }
    

    function sendToAll() {
        console.log(`sending to all ${connectedCons.length} connections`);
        const message: Message = {
            message: "hello world"
        }
        sendData(peer, connectedCons, setUnverifiedPackages, message, "message", connectedCons.map(c => c.peer));
    }

    async function sendCurrencyToEveryone() {
        console.log(`sending to all ${connectedCons.length} connections`);
        const transaction: Transaction = {
            amount: Math.round(Math.random()*1000),
            sender: peer.id,
            receiver: "everyone"
        }
        const signedTransaction: SignedTransaction = await signTransaction(transaction, privateKey);
        sendData(peer, connectedCons, setUnverifiedPackages, signedTransaction, "transaction", connectedCons.map(c => c.peer));
    }


    const publicKeysAsString = useMemo(() => {
        return JSON.stringify(Object.fromEntries(publicKeys));
    }, [publicKeys]);
    

    
    return (
        <div className="p-4">
            <p className="mb-4">Peer id: {peer.id}</p>
            {/* <input type="number" value={leadingZeros} onChange={(e) => setLeadingZeros(parseInt(e.target.value))} className="mb-4"/> */}

            <p>PublicKeys: {publicKeysAsString}</p>
            <p>Length: {publicKeys.size}</p>

            <div className="flex flex-rol gap-4">
                <Button onClick={sendToAll} className="mb-4">Send To All</Button>
                <Button onClick={sendCurrencyToEveryone} className="mb-4">Send Currency To Everyone</Button>
                <Button onClick={broadcastPublicKey} className="mb-4">Broadcast Public Key</Button>
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
                    <h1 className="text-xl font-bold mb-2">Transactions</h1>
                    {transactions.slice(-5).map((transaction, index) => (
                        <TransactionCard transaction={transaction} key={index} publicKeys={publicKeys}/>
                    ))}
                </div>
                
                {/* <div>
                    <h1 className="text-xl font-bold mb-2">Blockchain</h1>
                    {blockchain.slice(-5).map((packet, index) => (
                        <PacketUI key={index} packet={packet} blockchain={blockchain} connectedCons={connectedCons} setVerifiedPackages={setBlockchain} peer={peer}/>
                    ))}
                </div>
                <div>
                    <h1 className="text-xl font-bold mb-2">Unverified Packages</h1>
                    {unverifiedPackages.slice(-5).map((packet, index) => (
                        <PacketUI key={index} packet={packet} blockchain={blockchain} connectedCons={connectedCons} setVerifiedPackages={setUnverifiedPackages} peer={peer}/>
                    ))}
                </div> */}
            </div>
        </div>
    );
}