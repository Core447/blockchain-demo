import JSONPretty from "react-json-pretty";
import { Packet } from "./page";
import { calculateHashOfPacket, calculateProofOfWork, isHashValid } from "@/lib/hash";
import { Button } from "@/components/ui/button";
import AutoLoadingButton from "@/components/common/AutoLoadingButton/AutoLoadingButton";
import { sendBlockData, sendPacket } from "@/lib/communication";
import Peer, { DataConnection } from "peerjs";

interface PacketUIProps {
    packet: Packet
    blockchain: Packet[]
    connectedCons: DataConnection[]
    peer: Peer,
    setVerifiedPackages: React.Dispatch<React.SetStateAction<Packet[]>>
}
export default function PacketUI({ packet, blockchain, connectedCons, peer, setVerifiedPackages }: PacketUIProps) {
    function getHashOfLatestBlock() {
        if (blockchain.length === 0) {
            return null;
        }
        const latestBlock = blockchain[blockchain.length - 1];
        return calculateHashOfPacket(latestBlock);
    }
    async function handleMine() {
        // Create shallow copy of the packet
        const newPacket = { ...packet };
        // Set previous hash to hash of latest block
        newPacket.previousHash = getHashOfLatestBlock();
        // Calculate proof of work
        newPacket.proofOfWork = calculateProofOfWork(newPacket, 4);
        // Set already belongs to chain to true
        newPacket.alreadyBelongsToChain = true;
        console.log(`Mined packet:`, newPacket);
        // Broadcast packet
        // sendPacket(newPacket, connectedCons);
        sendBlockData(peer, connectedCons, setVerifiedPackages, newPacket.data, "block", connectedCons.map(c => c.peer), getHashOfLatestBlock()!, newPacket.proofOfWork!);
    }
    return (
        <div className="p-2 border rounded mb-2">
            {
                !packet.alreadyBelongsToChain && (
                    <AutoLoadingButton onClick={handleMine}>Mine</AutoLoadingButton>
                )
            }
            <p>From: {packet.sender}</p>
            {/* <p>Message: {JSON.stringify(packet)}</p> */}
            <JSONPretty id="json-pretty" data={packet}></JSONPretty>
            <p className={`${isHashValid(calculateHashOfPacket(packet), 4) ? "text-green-500" : "text-red-500"}`}>Hash: {calculateHashOfPacket(packet)}</p>
        </div>
    )
}