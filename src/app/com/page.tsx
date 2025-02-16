"use client";
import { Button } from "@/components/ui/button";
import { DataConnection, Peer } from "peerjs";
import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";
import { useQuery } from "@tanstack/react-query";
import JSONPretty from 'react-json-pretty';
import 'react-json-pretty/themes/monikai.css';
import { createHash } from 'crypto';
import { calculateHashOfPacket, isHashValid } from "@/lib/hash";
import PacketUI from "./PacketUI";
import { sendData } from "@/lib/communication";
import { generateKey } from "openpgp";
import { SignedTransactionData, Transaction } from "@/lib/transactions";
import TransactionCard from "./TransactionCard";
import { useBlockChainContext } from "@/context/blockchain";
import { useConnectionContext } from "@/context/connectionContext";
import { useOpenPGPContext } from "@/context/openpgp";
import { Block, MinedBlock, MinedBlockData } from "@/lib/blocks";
import { Payload } from "@/lib/requester";
import { RequestOtherPublicKey } from "@/lib/messages";
import BlockCard from "./BlockCard";




export interface Data {
}

export interface Message extends Data {
    message: string;
}

export interface Packet {
    sender: string;
    receivers: string[];
    // alreadyBelongsToChain: boolean;
    type: string;
    data: Data;
    // proofOfWork: number | null;
    // previousHash: string | null;
}

export interface PublicKeyShare {
    publicKey: string;
}


export interface BroadcastOtherPublicKeys {
    otherPublicKeys: Map<string, string>;
}


export default function Page() {
    const [unverifiedPackages, setUnverifiedPackages] = useState<Packet[]>([]);

    const blockchain = useBlockChainContext();
    const pgp = useOpenPGPContext();

    const { peer, peerName, connectedCons, addDataHandler, requesters, addRRHandler } = useConnectionContext();
    // const [areDataHandlersSet, setAreDataHandlersSet] = useState(false);
    const areDataHandlersSet = useRef(false);

    useEffect(() => {
        if (areDataHandlersSet.current) {
            return;
        }
        areDataHandlersSet.current = true;

        addDataHandler((packet: Packet) => {
            if (packet.type == "publicKeyShare") {
                const publicSharePacket = packet.data as PublicKeyShare;
                pgp.publicKeysRef.current.set(packet.sender, publicSharePacket.publicKey);
                pgp.setPublicKeys(new Map(pgp.publicKeysRef.current));
                // setPublicKeys(new Map(publicKeysRef.current));
                console.log("public keys", pgp.publicKeys);
            }
            if (packet.type == "transaction") {
                const data = packet.data as SignedTransactionData;
                const transaction = new Transaction(
                    data.index,
                    data.amount,
                    data.sender,
                    data.receiver,
                    data.signMessage,
                )
                blockchain.addPendingTransaction(transaction);
            }

            if (packet.type == "block") {
                const blockData = packet.data as MinedBlockData;

                const transactions = blockData.transactions.map(transaction => {
                    return new Transaction(
                        transaction.index,
                        transaction.amount,
                        transaction.sender,
                        transaction.receiver,
                        transaction.signMessage,
                    )
                })

                const previousBlock = blockchain.getBlockByHash(blockData.previousHash);

                console.log("searching for previous block with hash:", blockData.previousHash);

                if (blockData.previousHash && !previousBlock) {
                    console.error("Could not find previous block:", blockData.previousHash);
                    return;
                }

                const block = new MinedBlock(previousBlock, blockData.proofOfWork, transactions);
                console.log("received block", block);
                blockchain.addBlock(block, true);
            }
        });

        addRRHandler("requestOtherPublicKey", (r) => {
            const payload = r.payload as RequestOtherPublicKey;
            console.log("searching in public keys:", pgp.publicKeysRef)
            const otherPublicKey = pgp.publicKeysRef.current.get(payload.peer);

            return {
                type: "publicKeyShare",
                payload: {
                    publicKey: otherPublicKey
                }
            }
        })

    }, [])






    async function sendCurrencyToEveryone() {
        console.log(`sending to all ${connectedCons.length} connections`);
        const amount = Math.round(Math.random() * 1000)
        for (const conn of connectedCons) {
            const transaction = new Transaction(
                blockchain.ownTransactionIDRef.current,
                amount,
                peer.id,
                conn.peer,
                null
            )
            blockchain.incrementOwnTransactionID();
            await transaction.signTransaction(pgp.privateKey);
            console.log("sending:", transaction.getDataWithSignature());
            blockchain.addPendingTransaction(transaction);
            sendData(peer, connectedCons, transaction.getDataWithSignature(), "transaction", connectedCons.map(c => c.peer));
        }
    }


    function mineLatestTransaction() {
        const minedBlock = blockchain.mineBlockFromTransactions(blockchain.pendingTransactions.slice(0, 1));

        console.log("mined block:", minedBlock);
        blockchain.addBlock(minedBlock, true);
        // TODO: broadcast mined block - other ones will remove pending transactions themselves

        sendData(peer, connectedCons, minedBlock.getData(), "block", connectedCons.map(c => c.peer));

        // Find transactions to remove
        // const transactionsToRemove = transactions.filter(t => pendingTransactions.includes(t));
        // setPendingTransactions(pendingTransactions.filter(t => !transactionsToRemove.includes(t)));

        // blockchain.setPendingTransactions(blockchain.pendingTransactions.filter(t => !minedBlock.transactions.includes(t)));
    }

    async function requestPublicKeys() {
        console.log("requesting public keys");
        await Promise.all(
            connectedCons.map(async (conn) => {
                const requester = requesters.get(conn.peer);
                if (requester) {
                    const publicKey = await requester.request<Payload<RequestOtherPublicKey>, Payload>({
                        type: "requestOtherPublicKey",
                        payload: {
                            peer: peerName
                        }
                    });
                    console.log("received public key:", publicKey.payload);
                }
            })
        )
    }

    const ownBalance = useMemo(() => {
        return blockchain.calculateBalance(pgp.publicKeysRef.current, peer.id);
    }, [blockchain, peer.id, pgp.publicKeysRef.current]);


    return (
        <div className="p-4">
            <p className="mb-4">Peer id: {peer.id}</p>
            {/* <input type="number" value={leadingZeros} onChange={(e) => setLeadingZeros(parseInt(e.target.value))} className="mb-4"/> */}

            <p>Number of public keys: {pgp.publicKeys.size}</p>
            <p>Own balance: {ownBalance}</p>

            <div className="flex flex-rol gap-4">
                {/* <Button onClick={sendToAll} className="mb-4">Send To All</Button> */}
                <Button onClick={sendCurrencyToEveryone} className="mb-4">Send Currency To Everyone</Button>
                {/* <Button onClick={broadcastPublicKey} className="mb-4">Broadcast Public Key</Button> */}
                <Button onClick={mineLatestTransaction} className="mb-4">Mine Latest Transaction</Button>
                <Button onClick={requestPublicKeys} className="mb-4">Request Public Keys</Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <h1 className="text-xl font-bold mb-2">Active connections: {connectedCons.length}</h1>
                    {connectedCons.map((conn, index) => (
                        <div key={index} className="p-2 border rounded mb-2">
                            <p>{conn.peer} (Status: {conn.open ? 'Open' : 'Closed'})</p>
                        </div>
                    ))}
                </div>

                <div>
                    <h1 className="text-xl font-bold mb-2">Pending Transactions</h1>
                    {blockchain.pendingTransactions.slice(-5).map((transaction, index) => (
                        <TransactionCard transaction={transaction} key={index} publicKeys={pgp.publicKeys} />
                    ))}
                </div>

                <div>
                    <h1 className="text-xl font-bold mb-2">Mined Blocks</h1>
                    {blockchain.blocks.slice(-5).map((block, index) => (
                        <BlockCard key={index} block={block} />
                    ))}
                </div>


                {/* <div>
                    <h1 className="text-xl font-bold mb-2">Blockchain</h1>
                    {blockchain.slice(-5).map((packet, index) => (
                        <PacketUI key={index} packet={packet} blockchain={blockchain} connectedCons={connectedCons} setVerifiedPackages={setBlockchain} peer={peer}/>
                    ))}
                </div>
                <div>
                    <h1 className="text-xl font-bold mb-2">Unverified Packages</h1>
                    {unverifiedPackages.slice(-5).map((packet, index) => (
                        <PacketUI key={index} packet={packet} blockchain={blockchain} connectedCons={connectedCons} setVerifiedPackages={setUnverifiedPackages} peer={peer}/>
                    ))}
                </div> */}
            </div>
        </div>
    );
}