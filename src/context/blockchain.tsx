"use client";

import { Blockchain } from "@/lib/blockchain";
import { Block, PendingBlock } from "@/lib/blocks";
import { Transaction } from "@/lib/transactions";
import { createContext, useContext, useState } from "react";

type BlockChainContextType = {
    // blockchain: Blockchain
    pendingTransactions: Transaction[]
    blocks: Block[]
    addPendingTransaction: (transaction: Transaction) => void
    addBlock: (block: Block) => void
    mineBlockFromTransactions: (transactions: Transaction[]) => void
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
    const [pendingTransactions, setPendingTransactions] = useState<Transaction[]>([]);
    const [blocks, setBlocks] = useState<Block[]>([]);

    function addPendingTransaction(transaction: Transaction) {
        setPendingTransactions(prev => [...prev, transaction]);
    }

    function addBlock(block: Block) {
        setBlocks([...blocks, block]);
    }

    function mineBlockFromTransactions(transactions: Transaction[]) {
        const block = new PendingBlock(transactions);
        const minedBlock = block.mine("prev");
        addBlock(minedBlock);
        // TODO: broadcast mined block - other ones will remove pending transactions themselves

        // Find transactions to remove
        // const transactionsToRemove = transactions.filter(t => pendingTransactions.includes(t));
        // setPendingTransactions(pendingTransactions.filter(t => !transactionsToRemove.includes(t)));

        setPendingTransactions(pendingTransactions.filter(t => !transactions.includes(t)));
    }

    return (
        <BlockChainContext.Provider value={{ pendingTransactions, blocks, addPendingTransaction, addBlock, mineBlockFromTransactions }}>
            {children}
        </BlockChainContext.Provider>
    )
}