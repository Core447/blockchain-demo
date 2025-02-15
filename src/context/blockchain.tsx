"use client";

import { Blockchain } from "@/lib/blockchain";
import { Block, MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction } from "@/lib/transactions";
import { createContext, useContext, useRef, useState } from "react";

type BlockChainContextType = {
    // blockchain: Blockchain
    pendingTransactions: Transaction[]
    blocks: MinedBlock[]
    blocksRef: React.MutableRefObject<MinedBlock[]>
    addPendingTransaction: (transaction: Transaction) => void
    addBlock: (block: MinedBlock, removeFromPending?: boolean) => void
    mineBlockFromTransactions: (transactions: Transaction[]) => MinedBlock
    setPendingTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>
    ownTransactionIDState: number
    ownTransactionIDRef: React.MutableRefObject<number>
    setOwnTransactionID: (transactionID: number) => void
    incrementOwnTransactionID: () => void
    getBlockByHash: (hash: string) => MinedBlock | null
    calculateBalance: (publicKeys: Map<string, string>, userId: string) => number
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
    // const [blockchain, setBlockchain] = useState(new Blockchain());
    const pendingTransactionsRef = useRef<Transaction[]>([]);
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [blocks, setBlocks] = useState<MinedBlock[]>([]);
    const blocksRef = useRef<MinedBlock[]>([]);

    const ownTransactionIDRef = useRef(0);
    const [ownTransactionIDState, setOwnTransactionIDState] = useState(0);

    function setOwnTransactionID(transactionID: number) {
        setOwnTransactionIDState(transactionID);
        ownTransactionIDRef.current = transactionID;
    }

    function incrementOwnTransactionID() {
        setOwnTransactionIDState(prev => prev + 1);
    }

    function addPendingTransaction(transaction: Transaction) {
        // setPendingTransactions(prev => [...prev, transaction]);
        pendingTransactionsRef.current = [...pendingTransactionsRef.current, transaction];
        setPendingTransactions(pendingTransactionsRef.current);
    }

    function getBlockByHash(hash: string): MinedBlock | null {
        return blocksRef.current.find(block => block.getHash() == hash) ?? null;
    }

    function addBlock(block: MinedBlock, removeFromPending = false) {
        // setBlocks([...blocks, block]);
        blocksRef.current.push(block);
        setBlocks(blocksRef.current);
        // setBlocks(prev => [...prev, block]);

        let transactionToRemove: Transaction | null = null;

        if (removeFromPending) {
            // setPendingTransactions(prev => prev.filter(t => !block.transactions.includes(t)));
            console.log("pending transactions:", pendingTransactionsRef);
            console.log("is Eq:", pendingTransactionsRef.current[0].isEqual(block.transactions[0]));


            pendingTransactionsRef.current.forEach((pendingTransaction, index) => {
                block.transactions.forEach(blockTransaction => {
                    if (pendingTransaction.isEqual(blockTransaction)) {
                        transactionToRemove = pendingTransaction;
                    }
                })
            })
        }

        if (!transactionToRemove) {
            console.log("error");
            return;
        }
        // setPendingTransactions(prev => prev.filter(t => !transactionToRemove.isEqual(t)));
        console.log("transaction to remove:", transactionToRemove);
        pendingTransactionsRef.current = pendingTransactionsRef.current.filter(t => !transactionToRemove.isEqual(t));
        setPendingTransactions(pendingTransactionsRef.current);
    }

    function mineBlockFromTransactions(transactions: Transaction[]): MinedBlock {
        const block = new PendingBlock(transactions);
        const latestBlock = blocks[blocks.length - 1];
        return block.mine(latestBlock);
    }

    function getAllTransactionsInChain() {
        const transactions = [];
        for (const block of blocks) {
            transactions.push(...block.transactions);
        }
        return transactions;
    }

    function getValidTransactions(publicKeys: Map<string, string>) {
        const allTransactions = getAllTransactionsInChain();
        let userIds = [...allTransactions.map(transaction => transaction.sender), ...allTransactions.map(transaction => transaction.receiver)];
        userIds = Array.from(new Set(userIds));

        let senderIds = allTransactions.map(transaction => transaction.sender);
        senderIds = Array.from(new Set(senderIds));

        const validTransactions = [];
        for (const senderId of senderIds) {
            const previousTransactionsOfUser = [];
            const senderTransactions = allTransactions.filter(transaction => transaction.sender === senderId);
            for (const transaction of senderTransactions) {
                if (transaction.isValid(publicKeys, previousTransactionsOfUser)) {
                    validTransactions.push(transaction);
                    previousTransactionsOfUser.push(transaction);
                }
            }
        }

        return validTransactions;
    }

    function calculateBalance(publicKeys: Map<string, string>, userId: string) {
        // get all transactions
        if (blocks.length === 0) {
            return 0;
        }
        const latestBlock = blocks[blocks.length - 1];
        // const transactions = latestBlock.getAllTransactionsInChain();
        const transactions = getValidTransactions(publicKeys);
        const outgoingTransactions = transactions.filter(transaction => transaction.sender === userId);
        const incomingTransactions = transactions.filter(transaction => transaction.receiver === userId);
        const outgoingAmount = outgoingTransactions.reduce((total, transaction) => total + transaction.amount, 0);
        const incomingAmount = incomingTransactions.reduce((total, transaction) => total + transaction.amount, 0);
        return incomingAmount - outgoingAmount;
    }


    return (
        <BlockChainContext.Provider value={{ pendingTransactions, blocks, addPendingTransaction, addBlock, mineBlockFromTransactions, setPendingTransactions, ownTransactionIDState, ownTransactionIDRef, setOwnTransactionID, incrementOwnTransactionID, getBlockByHash, blocksRef, calculateBalance }}>
            {children}
        </BlockChainContext.Provider>
    )
}