import { Data, Packet } from "@/app/com/page";
import Peer, { DataConnection } from "peerjs";

export function sendData(peer: Peer, connectedCons: DataConnection[], data: Data, type: string, to: string[]) {
    console.log(`Preparing to send ${type} data to ${to.length} recipients:`, to);
    
    // If no specific recipients are specified, send to all connected clients
    const recipients = to.length > 0 ? to : connectedCons.map(c => c.peer);
    
    const packet: Packet = {
        type: type,
        data: data,
        sender: peer.id,
        receivers: recipients,
    }
    
    console.log(`Sending ${type} packet:`, packet);
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
    console.log(`Sending packet to ${packet.receivers.length} recipients:`, packet.receivers);
    
    // Track successful sends
    let successfulSends = 0;
    
    packet.receivers.forEach((receiver) => {
        const conn = connectedCons.find((c) => c.peer === receiver);
        if (conn) {
            try {
                conn.send(packet);
                console.log(`Successfully sent packet to ${receiver}`);
                successfulSends++;
            } catch (error) {
                console.error(`Error sending to ${receiver}:`, error);
            }
        } else {
            console.warn(`Connection not found for receiver: ${receiver}`);
        }
    });
    
    console.log(`Sent packet to ${successfulSends} of ${packet.receivers.length} recipients`);
}