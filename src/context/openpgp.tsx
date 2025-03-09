"use client";

import { createContext, use, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useConnectionContext } from "./connectionContext";
import { generateKey } from "openpgp";
import { BroadcastOtherPublicKeys, PublicKeyShare } from "@/app/com/page";
import { sendData } from "@/lib/communication";
import { RequestOtherPublicKey, ResponseOtherPublicKey } from "@/lib/messages";
import { Payload } from "@/lib/requester";

export type OpenPGPContextType = {
    privateKey: string;
    publicKey: string;
    publicKeys: Map<string, string>;
    publicKeysRef: React.MutableRefObject<Map<string, string>>
    setPublicKeys: React.Dispatch<React.SetStateAction<Map<string, string>>>
    retrievePublicKeyFromNetwork: (peerName: string) => Promise<ResponseOtherPublicKey[]>
};

export const OpenPGPContext = createContext<OpenPGPContextType | null>(null);

export function useOpenPGPContext() {
    const context = useContext(OpenPGPContext);
    if (!context) {
        throw new Error("useOpenPGPContext must be used within a OpenPGPContextProvider");
    }
    return context;
}

export const OpenPGPProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [privateKey, setPrivateKey] = useState<string>("");
    const [publicKey, setPublicKey] = useState<string>("");
    // const publicKeys = useRef<Map<string, string>>(new Map());
    const publicKeysRef = useRef<Map<string, string>>(new Map());
    const [ publicKeys, setPublicKeys ] = useState<Map<string, string>>(new Map());

    const { peerName, peer, connectedCons, sendRRMessage, connectedConsRef } = useConnectionContext();

    useEffect(() => {
        async function load() {
            const { publicKey, privateKey } = await generateKey({
                userIDs: [{ name: peerName }],
            })
            setPublicKey(publicKey);
            setPrivateKey(privateKey);

            publicKeysRef.current.set(peerName, publicKey);
            setPublicKeys(new Map(publicKeysRef.current));
        }
        load();
    }, [peerName]);

    const broadcastPublicKey = useCallback(() => {
        console.info("broadcasting public key");
        const data: PublicKeyShare = {
            publicKey: publicKey
        }
        sendData(peer, connectedCons, data, "publicKeyShare", connectedCons.map(c => c.peer));
    }, [publicKey, peer, connectedCons]);

    const broadcastOtherPublicKeys = useCallback(() => {
        console.info("broadcasting other public keys");
        const otherPublicKeys = new Map<string, string>(publicKeysRef.current);
        otherPublicKeys.delete(peerName);
        const data: BroadcastOtherPublicKeys = {
            otherPublicKeys: otherPublicKeys
        }
        sendData(peer, connectedCons, data, "broadcastOtherPublicKeys", connectedCons.map(c => c.peer));
    }, [peer, connectedCons, peerName]);

    // broadcast new public key
    useEffect(() => {
        broadcastPublicKey();
    }, [broadcastPublicKey]);

    const retrievePublicKeyFromNetwork = useCallback(async (peerName: string) => {
        console.log("asking", connectedConsRef.current.length, "connections for public key");
        const answers = await Promise.all(connectedConsRef.current.map(async (conn) => {
            console.log("sending request to", conn.peer);
            const r = sendRRMessage<Payload<RequestOtherPublicKey>, Payload<ResponseOtherPublicKey>>(conn.peer, {
                type: "requestOtherPublicKey",
                payload: {
                    peer: peerName
                }
            }
        )
        }));
        console.log("answers:", answers);

        if (answers.length === 0) {
            return;
        }

        return answers[0].payload.publicKey;


        return answers;
    }, []);


    return (
        <OpenPGPContext.Provider value={{ privateKey, publicKey, publicKeys: publicKeys, publicKeysRef, setPublicKeys, retrievePublicKeyFromNetwork }}>
            {children}
        </OpenPGPContext.Provider>
    );
}