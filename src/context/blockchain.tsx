"use client";

import { Block, MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction, transactionsFromTransactionsData } from "@/lib/transactions";
import { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useConnectionContext } from "./connectionContext";
import { Payload } from "@/lib/requester";
import { RequestAllBlocks, ResponseAllBlocks } from "@/lib/messages";
import { Blockchain } from "@/classes/blockchain";

export type BlockChainContextType = {
    // blockchain: Blockchain
    pendingTransactions: Transaction[]
    minedBlocks: MinedBlock[]
    addPendingTransaction: (transaction: Transaction) => void
    addBlock: (block: MinedBlock, removeFromPending?: boolean) => void
    mineBlockFromTransactions: (transactions: Transaction[]) => MinedBlock | null
    setPendingTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
    getBlockByHash: (hash: string | null) => MinedBlock | null
    calculateBalance: (publicKeys: Map<string, string>, userId: string) => number
    clearBlocks: () => void
    sendCurrencyToEveryone: (privateKey: string) => void
    mineLatestTransaction: () => void
}

const BlockChainContext = createContext<BlockChainContextType | null>(null);

export const useBlockChainContext = () => {
    const context = useContext(BlockChainContext);
    if (!context) {
        throw new Error("useBlockChainContext must be used within a BlockChainProvider");
    }
    return context;
}

export const BlockChainProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [minedBlocks, setMinedBlocks] = useState<MinedBlock[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const blockchainRef = useRef<Blockchain | null>(null);

    const { connection } = useConnectionContext();

    // Initialize blockchain only once
    useEffect(() => {
        if (!connection) return;
        // Only create a new blockchain if we don't have one yet
        if (!blockchainRef.current) {
            blockchainRef.current = new Blockchain(
                connection,
                (minedBlocks: MinedBlock[]) => {
                    setMinedBlocks(minedBlocks);
                },
                (pendingTransactions: Transaction[]) => {
                    setPendingTransactions(pendingTransactions);
                }
            );
            blockchainRef.current.loadBlocksFromOtherClients();
        }

        // Cleanup function to destroy the blockchain when the component unmounts
        return () => {
            if (blockchainRef.current) {
                blockchainRef.current = null;
            }
        };
    }, [connection]);

    const blockchain = blockchainRef.current;

    const clearBlocks = useCallback(() => {
        if (blockchain) {
            blockchain.clearBlocks();
            setMinedBlocks([]);
        }
    }
    , [blockchain]);

    const addPendingTransaction = useCallback((transaction: Transaction) => {
        if (blockchain) {
            blockchain.addPendingTransaction(transaction);
        }
    }, [blockchain]);

    const addBlock = useCallback((block: MinedBlock, removeFromPending?: boolean) => {
        if (blockchain) {
            blockchain.addBlock(block, removeFromPending);
        }
    }, [blockchain]);

    const mineBlockFromTransactions = useCallback((transactions: Transaction[]) => {
        if (blockchain) {
            return blockchain.mineBlockFromTransactions(transactions);
        }
        return null;
    }, [blockchain]);

    const getBlockByHash = useCallback((hash: string | null) => {
        if (blockchain) {
            return blockchain.getBlockByHash(hash);
        }
        return null;
    }, [blockchain]);

    const calculateBalance = useCallback((publicKeys: Map<string, string>, userId: string) => {
        if (!blockchain) return 0;
        return blockchain.calculateBalance(publicKeys, userId);
    }, [blockchain]);

    const sendCurrencyToEveryone = useCallback((privateKey: string) => {
        if (!blockchain) return;
        blockchain.sendCurrencyToEveryone(privateKey);
    }, [blockchain]);

    const mineLatestTransaction = useCallback(() => {
        if (!blockchain) return;
        blockchain.mineLatestTransaction();
    }, [blockchain]);


    return (
        <BlockChainContext.Provider value={{
            clearBlocks,
            pendingTransactions,
            minedBlocks,
            addPendingTransaction,
            addBlock,
            mineBlockFromTransactions,
            setPendingTransactions,
            getBlockByHash,
            calculateBalance,
            sendCurrencyToEveryone,
            mineLatestTransaction
        }}>
            {children}
        </BlockChainContext.Provider>
    )
}