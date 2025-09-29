"use client";

import { Block, MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction, transactionsFromTransactionsData } from "@/lib/transactions";
import { createContext, use, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useConnectionContext } from "./connectionContext";
import { Payload } from "@/lib/requester";
import { RequestAllBlocks, ResponseAllBlocks } from "@/lib/messages";
import { Blockchain } from "@/classes/blockchain";
import { useOpenPGPContext } from "./openpgp";

export type BlockChainContextType = {
    // blockchain: Blockchain
    pendingTransactions: Transaction[]
    minedBlocks: MinedBlock[]
    isMining: boolean
    addPendingTransaction: (transaction: Transaction) => void
    addBlock: (block: MinedBlock, removeFromPending?: boolean) => void
    mineBlockFromTransactions: (transactions: Transaction[], numberOfBlockRewardsToClaim: number) => MinedBlock | null
    setPendingTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
    getBlockByHash: (hash: string | null) => MinedBlock | null
    calculateBalance: (publicKeys: Map<string, string>, userId: string) => Promise<number>
    clearBlocks: () => void
    sendCurrencyToEveryone: (privateKey: string) => void
    mineLatestTransaction: (numberOfBlockRewardsToClaim: number) => Promise<void>
    sendMoney: (receiver: string, amount: number, privateKey: string) => Promise<void>
    sendMoneyInTheNameOfSomeone: (sender: string, receiver: string, amount: number) => Promise<void>
    broadcastBlock: (block: MinedBlock) => void
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
    const [isMining, setIsMining] = useState<boolean>(false);
    const blockchainRef = useRef<Blockchain | null>(null);

    const { connection } = useConnectionContext();
    // const { pgp } = useOpenPGPContext();

    // Initialize blockchain only once
    useEffect(() => {
        if (!connection) return;
        // Only create a new blockchain if we don't have one yet
        if (!blockchainRef.current) {
            blockchainRef.current = new Blockchain(
                // pgp,
                connection,
                (minedBlocks: MinedBlock[]) => {
                    setMinedBlocks(minedBlocks);
                },
                (pendingTransactions: Transaction[]) => {
                    setPendingTransactions(pendingTransactions);
                }
            );
            // Initial load to try to get blocks & pending transactions from existing connections
            blockchainRef.current.loadBlocksFromOtherClients();
            blockchainRef.current.loadPendingTransactionsFromOtherClients();
            
            // Also load blocks when new connections are established
            connection.addToCallOnNewConnections(() => {
                if (blockchainRef.current) {
                    blockchainRef.current.loadBlocksFromOtherClients();
                    blockchainRef.current.loadPendingTransactionsFromOtherClients();
                }
            });
        }
    }, [connection]);

    const clearBlocks = useCallback(() => {
        if (blockchainRef.current) {
            blockchainRef.current.clearBlocks();
            setMinedBlocks([]);
        }
    }, []);

    const addPendingTransaction = useCallback((transaction: Transaction) => {
        if (blockchainRef.current) {
            blockchainRef.current.addPendingTransaction(transaction);
        } else {
            console.error("Blockchain is not initialized");
        }
    }, []);

    const addBlock = useCallback((block: MinedBlock, removeFromPending?: boolean) => {
        if (blockchainRef.current) {
            blockchainRef.current.addBlock(block, removeFromPending);
        }
    }, []);

    const mineBlockFromTransactions = useCallback((transactions: Transaction[], numberOfBlockRewardsToClaim: number) => {
        if (blockchainRef.current) {
            return blockchainRef.current.mineBlockFromTransactions(transactions, numberOfBlockRewardsToClaim);
        }
        return null;
    }, []);

    const getBlockByHash = useCallback((hash: string | null) => {
        if (blockchainRef.current) {
            return blockchainRef.current.getBlockByHash(hash);
        }
        return null;
    }, []);

    const calculateBalance = useCallback(async(publicKeys: Map<string, string>, userId: string) => {
        if (!blockchainRef.current) return 0;
        return await blockchainRef.current.calculateBalance(publicKeys, userId);
    }, []);

    const sendCurrencyToEveryone = useCallback((privateKey: string) => {
        if (!blockchainRef.current) return;
        blockchainRef.current.sendCurrencyToEveryone(privateKey);
    }, []);

    const mineLatestTransaction = useCallback(async (numberOfBlockRewardsToClaim: number) => {
        if (!blockchainRef.current) return;
        
        setIsMining(true);
        try {
            // Use the async mining method that yields control periodically
            await blockchainRef.current.mineLatestTransactionAsync(numberOfBlockRewardsToClaim);
        } finally {
            setIsMining(false);
        }
    }, []);

    const sendMoney = useCallback(async(receiver: string, amount: number, privateKey: string) => {
        if (!blockchainRef.current) return;
        await blockchainRef.current.sendMoney(receiver, amount, privateKey);
    }, []);

    const sendMoneyInTheNameOfSomeone = useCallback(async(sender: string, receiver: string, amount: number) => {
        if (!blockchainRef.current) return;
        await blockchainRef.current.sendMoneyInTheNameOfSomeone(sender, receiver, amount);
    }, []);

    const broadcastBlock = useCallback((block: MinedBlock) => {
        if (!blockchainRef.current) return;
        blockchainRef.current.broadcastBlock(block);
    }, []);

    return (
        <BlockChainContext.Provider value={{
            clearBlocks,
            pendingTransactions,
            minedBlocks,
            isMining,
            addPendingTransaction,
            addBlock,
            mineBlockFromTransactions,
            setPendingTransactions,
            getBlockByHash,
            calculateBalance,
            sendCurrencyToEveryone,
            mineLatestTransaction,
            sendMoney,
            sendMoneyInTheNameOfSomeone,
            broadcastBlock
        }}>
            {children}
        </BlockChainContext.Provider>
    )
}