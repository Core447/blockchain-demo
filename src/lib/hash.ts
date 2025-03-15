import { Packet } from "@/app/com/page";
import { createHash } from "crypto";

export function calculateHashOfPacket(packet: Packet): string {
    const packetString = JSON.stringify(packet);
    const hash = createHash('sha1');
    hash.update(packetString);
    return hash.digest('hex');
}


export function isHashValid(hash: string, nLeadingZeros: number): boolean {
    return hash.startsWith('0'.repeat(nLeadingZeros));
}