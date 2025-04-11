"use client";

import { Block, MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction, transactionsFromTransactionsData } from "@/lib/transactions";
import { createContext, use, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useConnectionContext } from "./connectionContext";
import { Payload } from "@/lib/requester";
import { RequestAllBlocks, ResponseAllBlocks } from "@/lib/messages";

export type BlockChainContextType = {
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
    getBlockByHash: (hash: string | null) => MinedBlock | null
    calculateBalance: (publicKeys: Map<string, string>, userId: string) => number
    blocksSet: React.MutableRefObject<Set<MinedBlock>>
    clearBlocks: () => void
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

    const blocksSet = useRef(new Set<MinedBlock>());

    const { requesters: requestersState, peerName: PN } = useConnectionContext();

    const getLongestChain = useCallback(() => {
        const longestChain: MinedBlock[] = [];
        for (const block of Array.from(blocksSet.current)) {
            const chain = generateChainEndingAtBlock(block);
            if (chain.length > longestChain.length) {
                longestChain.splice(0, longestChain.length);
                longestChain.push(...chain);
            }
        }
        return longestChain;
    }, []);

    const addBlockToSet = useCallback((block: MinedBlock) => {
        console.log("adding block to set");
        blocksSet.current.add(block);

        const mainBlockChain = getLongestChain();
        console.log("blocks in chain", blocksSet.current.size);
        console.log("new length of mainBlockChain", mainBlockChain.length);
        blocksRef.current = mainBlockChain;




        // blocksRef.current = [...blocksRef.current, block];


        setBlocks(blocksRef.current);
    }, [getLongestChain]);

    const setPrevBlockRefs = useCallback(() => {
        for (const block of blocksRef.current) {
            block.previousBlock = getBlockByHash(block.getHash());
        }
        setBlocks(blocksRef.current);
    }, []);

    // getBlocksFromOtherClients
    useEffect(() => {
        console.log("bbc getting blocks from other clients", requestersState.size);
        requestersState.forEach((requester, peerName) => {
            if (peerName == PN) {
                alert("skipping own peer");
            }
            requester.request<Payload<RequestAllBlocks>, Payload<ResponseAllBlocks>>({
                type: "getAllBlocks",
                payload: {
                    blocks: Array.from(blocksSet.current)
                }
            }).then((response) => {
                console.log("bbc got response from", peerName, response);
                if (!response) return;
                if (!response.payload) return;
                console.log(response);
                for (const blockData of response.payload.blocks) {
                    const block = new MinedBlock(
                        null,
                        blockData.previousHash,
                        blockData.proofOfWork,
                        transactionsFromTransactionsData(blockData.transactions),
                    )
                    addBlockToSet(block);
                }
                setPrevBlockRefs();
                
            })
        })

    }, [requestersState, addBlockToSet, PN, setPrevBlockRefs]);

    


    // Merge stuff
    function generateChainEndingAtBlock(block: MinedBlock): MinedBlock[] {
        const chain: MinedBlock[] = [];
        let currentBlock : MinedBlock | null = block;
        while (currentBlock) {
            chain.push(currentBlock);
            //currentBlock = currentBlock.previousBlock;
            // currentBlock = currentBlock.previousBlock;
            currentBlock = getBlockByHash(currentBlock.previousBlockHash);
        }
        chain.reverse();
        return chain;
    }

    





    const ownTransactionIDRef = useRef(0);
    const [ownTransactionIDState, setOwnTransactionIDState] = useState(0);

    function setOwnTransactionID(transactionID: number) {
        setOwnTransactionIDState(transactionID);
        ownTransactionIDRef.current = transactionID;
    }

    function incrementOwnTransactionID() {
        ownTransactionIDRef.current++;
        setOwnTransactionIDState(prev => prev + 1);
    }

    function addPendingTransaction(transaction: Transaction) {
        // setPendingTransactions(prev => [...prev, transaction]);
        pendingTransactionsRef.current = [...pendingTransactionsRef.current, transaction];
        setPendingTransactions(pendingTransactionsRef.current);
    }

    function getBlockByHash(hash: string | null): MinedBlock | null {
        return blocksRef.current.find(block => block.getHash() == hash) ?? null;
    }

    function clearBlocks() {
        blocksRef.current = [];
        setBlocks([]);
    }

    function addBlock(block: MinedBlock, removeFromPending = false) {
        console.log("adding block", block);
        // setBlocks([...blocks, block]);
        // blocksRef.current.push(block);
        // setBlocks(blocksRef.current);
        addBlockToSet(block);
        // setBlocks(prev => [...prev, block]);

        let transactionToRemove: Transaction | null = null;

        if (removeFromPending) {
            // setPendingTransactions(prev => prev.filter(t => !block.transactions.includes(t)));
            console.log("pending transactions:", pendingTransactionsRef);


            pendingTransactionsRef.current.forEach((pendingTransaction, index) => {
                block.transactions.forEach(blockTransaction => {
                    if (pendingTransaction.isEqual(blockTransaction)) {
                        transactionToRemove = pendingTransaction;
                    }
                })
            })
        }

        if (!transactionToRemove) {
            console.log("no transaction to remove, continuing...");
            // return;
        }
        // setPendingTransactions(prev => prev.filter(t => !transactionToRemove.isEqual(t)));
        console.log("transaction to remove:", transactionToRemove);
        pendingTransactionsRef.current = pendingTransactionsRef.current.filter(t => !transactionToRemove?.isEqual(t));
        setPendingTransactions(pendingTransactionsRef.current);
    }

    function mineBlockFromTransactions(transactions: Transaction[]): MinedBlock {
        const block = new PendingBlock(transactions);
        const latestBlock = blocks[blocks.length - 1];
        return block.mine(latestBlock ?? null, latestBlock ? latestBlock.getHash() : null);
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
        <BlockChainContext.Provider value={{ clearBlocks, pendingTransactions, blocks, addPendingTransaction, addBlock, mineBlockFromTransactions, setPendingTransactions, ownTransactionIDState, ownTransactionIDRef, setOwnTransactionID, incrementOwnTransactionID, getBlockByHash, blocksRef, calculateBalance, blocksSet }}>
            {children}
        </BlockChainContext.Provider>
    )
}