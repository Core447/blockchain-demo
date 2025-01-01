"use client"

import Peer from "peerjs";
import { useEffect } from "react";

export default function Page() {
    useEffect(() => {
        console.log("connecting to chrome...");
        const peer = new Peer("firefox");
        peer.on("open", () => {
            console.log("ready");
            const conn = peer.connect("chrome");
            conn.on("open", () => {
                console.log("connected to chrome");
                conn.send("hello");
            })
        })
    }, [])

    function connect() {
        console.log("connecting to chrome...");
        const peer = new Peer("firefox", { debug: 2 });
        peer.on("open", () => {
            console.log("ready");

            const conn = peer.connect("chrome");
            conn.on("open", () => {
                console.log("connected to chrome");
                conn.send("hello");
            })
        })
    }
    return (
        <div>
            <button onClick={connect}>Connect</button>
        </div>
    );
}