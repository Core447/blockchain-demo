"use client"

import Peer from "peerjs";
import { useEffect } from "react";

export default function Page() {
    useEffect(() => {
        console.log("init");
        const peer = new Peer("chrome", { debug: 2 });
        peer.on("connection", (conn) => {
            conn.on("data", (data) => {
                console.log("received data", data);
            })
            conn.on("open", () => {
                console.log("firefox connected");
                conn.send("hello");
            })
        })
    }, [])
    return (
        <div></div>
    );
}