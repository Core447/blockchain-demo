"use client";

import { createContext, use, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useConnectionContext } from "./connectionContext";
import { generateKey } from "openpgp";
import { BroadcastOtherPublicKeys, PublicKeyShare } from "@/app/com/page";
import { sendData } from "@/lib/communication";
import { RequestOtherPublicKey, ResponseOtherPublicKey } from "@/lib/messages";
import { Payload } from "@/lib/requester";
import { PGP } from "@/classes/pgp";

export type OpenPGPContextType = {
    privateKey: string;
    publicKey: string;
    publicKeys: Map<string, string>;
    retrievePublicKeyFromNetwork: (peerName: string) => Promise<ResponseOtherPublicKey[] | undefined>;
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
    const [publicKeys, setPublicKeys] = useState<Map<string, string>>(new Map());
    const [privateKey, setPrivateKey] = useState<string>("");
    const [publicKey, setPublicKey] = useState<string>("");

    const pgpRef = useRef<PGP | null>(null);

    const { connection } = useConnectionContext();

    // Initialize only once
    useEffect(() => {
        if (!connection) return;
        if (!pgpRef.current) {
            pgpRef.current = new PGP(
                connection,
                (publicKeys: Map<string, string>) => {
                    setPublicKeys(publicKeys);
                }
                , (publicKey: string) => {
                    setPublicKey(publicKey);
                }
                , (privateKey: string) => {
                    setPrivateKey(privateKey);
                }
            );
            pgpRef.current.load();
        }

        return () => {
            if (pgpRef.current) {
                pgpRef.current = null;
            }
        };
    }, [connection]);

    const retrievePublicKeyFromNetwork = useCallback(async (peerName: string) => {
        if (!pgpRef.current) return;
        return await pgpRef.current.retrievePublicKeyFromNetwork(peerName);
    }, []);
        

    return (
        <OpenPGPContext.Provider value={{
            privateKey,
            publicKey,
            publicKeys: publicKeys,
            retrievePublicKeyFromNetwork
        }}>
            {children}
        </OpenPGPContext.Provider>
    );
}