import { generateKey } from "openpgp";
import { Connection } from "./connection";
import { BroadcastOtherPublicKeys, Packet, PublicKeyShare } from "@/app/com/page";
import { sendData } from "@/lib/communication";
import { Payload } from "@/lib/requester";
import { RequestOtherPublicKey, ResponseOtherPublicKey } from "@/lib/messages";

export class PGP {
    publicKey: string = "";
    privateKey: string = "";
    publicKeys: Map<string, string> = new Map();

    constructor(
        private connection: Connection,
        private onPublicKeysChanged: (publicKeys: Map<string, string>) => void,
        private onPublicKeyChanged: (publicKey: string) => void,
        private onPrivateKeyChanged: (privateKey: string) => void
    ) {

    }

    async load() {
        const { publicKey, privateKey } = await generateKey({
            userIDs: [{ name: this.connection.peerName }],
        })
        this.publicKey = publicKey;
        this.privateKey = privateKey;
        this.publicKeys.set(this.connection.peerName, publicKey);
        this.onPublicKeysChanged(this.publicKeys);
        this.onPrivateKeyChanged(privateKey);
        this.onPublicKeyChanged(publicKey);

        // this.broadcastPublicKey();
        this.connection.addToCallWhenLoaded(() => {
            this.broadcastPublicKey();
        });
        this.connection.addToCallOnNewConnections(() => {
            this.broadcastPublicKey();
        });
        this.connection.addDataHandler((packet: Packet) => {
            if (packet.type == "publicKeyShare") {
                const publicSharePacket = packet.data as PublicKeyShare
                this.publicKeys.set(packet.sender, publicSharePacket.publicKey)
                this.onPublicKeysChanged(this.publicKeys);
            }
        })

        this.connection.addRRHandler("requestOtherPublicKey", (r) => {
            const payload = r.payload as RequestOtherPublicKey
            const otherPublicKey = this.publicKeys.get(payload.peer)
      
            return {
              type: "publicKeyShare",
              payload: {
                publicKey: otherPublicKey,
              },
            }
          })
    }

    broadcastPublicKey() {
        console.log("broadcastPublicKey")
        if (!this.connection.peer) { return }
        console.info("broadcasting public key to " + this.connection.connectedCons.length, "connections");
        const data: PublicKeyShare = {
            publicKey: this.publicKey
        }
        sendData(this.connection.peer, this.connection.connectedCons, data, "publicKeyShare", this.connection.connectedCons.map(c => c.peer));
    }

    broadcastOtherPublicKeys() {
        if (!this.connection.peer) { return }
        console.info("broadcasting other public keys");
        const otherPublicKeys = new Map<string, string>(this.publicKeys);
        otherPublicKeys.delete(this.connection.peerName);
        const data: BroadcastOtherPublicKeys = {
            otherPublicKeys: otherPublicKeys
        }
        sendData(this.connection.peer, this.connection.connectedCons, data, "broadcastOtherPublicKeys", this.connection.connectedCons.map(c => c.peer));
    }

    async retrievePublicKeyFromNetwork(peerName: string) {
        console.log("asking", this.connection.connectedCons.length, "connections for public key");
        const answers = await Promise.all(this.connection.connectedCons.map(async (conn) => {
            console.log("sending request to", conn.peer);
            const r = await this.connection.sendRRMessage<Payload<RequestOtherPublicKey>, Payload<ResponseOtherPublicKey>>(conn.peer, {
                type: "requestOtherPublicKey",
                payload: {
                    peer: peerName
                }
            }
            )
            return r;
        }));
        console.log("answers:", answers);

        if (answers.length === 0) {
            return [];
        }

        // return answers[0].payload.publicKey;


        return answers.map(answer => answer.payload);
    }

}