"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";

interface Data {
    name: string
}

export default function Page() {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);

    const peerName = useMemo(() => {
        // Just for easier testing - discovery either via fastapi backend or next.js server
        // if (navigator.userAgent.toLowerCase().includes("firefox")) {
        //     return "firefox";
        // }
        // return "chrome";
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }, []);

    const addConnection = useCallback((conn: DataConnection) => {
        setConnectedCons(prev => {
            const exists = prev.some(c => c.peer === conn.peer); // we cant use connectedCons for checking, but have to use prev as we call addConnection multiple times before the next re-render when the connectedCons updates
            if (exists) return prev;
            return [...prev, conn];
        });
    }, []);
    
    useEffect(() => {
        const usedIds = connectedCons.map((c) => c.peer);
        console.log("used ids", usedIds);
        
    }, [connectedCons]);

    const peer = useMemo(() => {
        const peer = new Peer(peerName, {
            host: "localhost",
            port: 9000,
            path: "/blockchain",
        });
        peer.on("open", () => {
            // peer is ready
            loadConnections();
        })

        async function getOtherPeerNames(): Promise<string[]> {
            const response = await fetch("http://localhost:9000/blockchain/peerjs/peers"); //server start command: peerjs --port 9000 --key peerjs --path /blockchain --allow_discovery
            const data = await response.json();
            return data.filter((p: string) => p !== peerName);
        }

        async function loadConnections() {
            const initialOtherPeerNames = await getOtherPeerNames();
            initialOtherPeerNames.forEach((otherPeerName) => {
                // if (peer.id === "chrome") {
                //     return;
                // }
                const conn = peer.connect(otherPeerName);
                conn.on("open", () => {
                    conn.send("hello");
                    console.log(`connected to ${otherPeerName}`);
                    // setConnectedCons((prev) => [...prev, conn]);
                    addConnection(conn);
                });
            })
        }
        loadConnections();

        return peer;
    }, [peerName, addConnection]);

    

    useEffect(() => {
        peer.on("connection", (conn) => {
            // setConnectedCons((prev) => [...prev, conn]);
            conn.on("open", () => {
                addConnection(conn);
                // console.log("connection open");
            })
            conn.on("data", (data) => {
                console.log("received data", data);
            });
        });
    }, [peer, addConnection]);


    function sendToAll2() {
        console.log(`sending to all ${connectedCons.length} connections`);
        connectedCons.forEach((conn) => {
            if (conn.open) {
                // conn.send("sendToAll");
                const data: Data = {
                    name: "cool name"
                }
                conn.send(data);
            } else {
                console.warn("Connection is not open:", conn);
            }
        });
    }
    
    return (
        <div>
            <p>Peer id: {peer.id}</p>
            <button onClick={sendToAll2}>Send To All</button>
            <h1>connections:</h1>
            {connectedCons.map((conn, index) => {
                return (
                    <div key={index}>
                        <p>{conn.peer}</p>
                    </div>
                );
            })}
        </div>
    );
}