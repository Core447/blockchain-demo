"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";

export default function Page() {
    const [connectedCons, setConnectedCons] = useState<DataConnection[]>([]);
    const [connectingTo, setConnectingTo] = useState<string | null>(null);
    const [once, setOnce] = useState(false);

    const peerName = useMemo(() => {
        // Just for easier testing - discovery either via fastapi backend or next.js server
        if (navigator.userAgent.toLowerCase().includes("firefox")) {
            return "firefox";
        }
        return "chrome";
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }, []);


    const peer = useMemo(() => {
        const peer = new Peer(peerName);
        peer.on("open", () => {
            // peer is ready
            loadConnections();
        })

        function getOtherPeerNames(): string[] {
            return peerName === "firefox" ? ["chrome"] : ["firefox"];
        }

        function loadConnections() {
            const initialOtherPeerNames = getOtherPeerNames();
            initialOtherPeerNames.forEach((otherPeerName) => {
                // if (peer.id === "chrome") {
                //     return;
                // }
                const conn = peer.connect(otherPeerName);
                conn.on("open", () => {
                    conn.send("hello");
                    console.log(`connected to ${otherPeerName}`);
                    setConnectedCons((prev) => [...prev, conn]);
                });
            })
        }
        loadConnections();

        return peer;
    }, [peerName]);

    

    useEffect(() => {
        peer.on("connection", (conn) => {
            setConnectedCons((prev) => [...prev, conn]);
            conn.on("open", () => {
                // console.log("connection open");
            })
            conn.on("data", (data) => {
                console.log("received data", data);
            });
        });
    }, [peer]);


    function sendToAll2() {
        console.log(`sending to all ${connectedCons.length} connections`);
        connectedCons.forEach((conn) => {
            if (conn.open) {
                conn.send("sendToAll");
            } else {
                console.warn("Connection is not open:", conn);
            }
        });
    }
    
    return (
        <div>
            <p>Peer id: {peer.id}</p>
            <button onClick={sendToAll2}>Send To All</button>
        </div>
    );
}