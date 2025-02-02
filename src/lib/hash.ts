import { Packet } from "@/app/com/page";
import { createHash } from "crypto";

export function calculateHashOfPacket(packet: Packet): string {
    const packetString = JSON.stringify(packet);
    const hash = createHash('sha1');
    hash.update(packetString);
    return hash.digest('hex');
}

export function calculateProofOfWork(packet: Packet, nLeadingZeros: number): number {
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

export function isHashValid(hash: string, nLeadingZeros: number): boolean {
    return hash.startsWith('0'.repeat(nLeadingZeros));
}