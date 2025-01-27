"use client";

import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

export default function Page() {
    const clientsQuery = useQuery({
        queryKey: ['clients'],
        queryFn: async () => {
            const res = await fetch('http://localhost:9000/blockchain/peerjs/peers');
            return res.json();
        },
        refetchInterval: 1000
    });

    // log the clients
    useEffect(() => {
        console.log(clientsQuery.data);
    }, [clientsQuery.data]);


    return (
        <div>
            <p>Peer id: </p>
            <p>Clients on peerjs server: {JSON.stringify(clientsQuery.data)}</p>
        </div>
    );
}