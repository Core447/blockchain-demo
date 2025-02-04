import { Data, Packet } from "@/app/com/page";
import Peer, { DataConnection } from "peerjs";

export function sendData(peer: Peer, connectedCons: DataConnection[], data: Data, type: string, to: string[]) {
    const packet: Packet = {
        type: type,
        data: data,
        sender: peer.id,
        receivers: to,
        // proofOfWork: null,
        // alreadyBelongsToChain: false,
        // previousHash: null
    }
    sendPacket(packet, connectedCons);
}

export function sendBlockData(peer: Peer, connectedCons: DataConnection[], setVerifiedPackages: React.Dispatch<React.SetStateAction<Packet[]>>, data: Data, type: string, to: string[], prevBlockHash: string, proofOfWork: number) {
    const packet: Packet = {
        type: type,
        data: data,
        sender: peer.id,
        receivers: to,
        // proofOfWork: proofOfWork,
        // alreadyBelongsToChain: true,
        // previousHash: prevBlockHash
    }
    sendPacket(packet, connectedCons);
    setVerifiedPackages(prev => [...prev, packet]);
}

export function sendPacket(packet: Packet, connectedCons: DataConnection[]) {
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