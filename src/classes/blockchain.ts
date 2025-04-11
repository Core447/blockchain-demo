import { MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction } from "@/lib/transactions";

export class Blockchain {
    private _minedBlocks: MinedBlock[];
    private _pendingTransactions: Transaction[];
    public ownTransactionId: number;

    constructor(public onMinedBlocksChanged: (onMinedBlocksChanged: MinedBlock[]) => void, public onPendingTransactionsChanged: (pendingTransactions: Transaction[]) => void) {
        this._minedBlocks = [];
        this._pendingTransactions = [];
        this.ownTransactionId = 0;
    }

    get minedBlocks(): MinedBlock[] {
        return this._minedBlocks;
    }

    set minedBlocks(minedBlocks: MinedBlock[]) {
        this._minedBlocks = minedBlocks;
        this.onMinedBlocksChanged(minedBlocks);
    }

    get pendingTransactions(): Transaction[] {
        return this._pendingTransactions;
    }

    set pendingTransactions(pendingTransactions: Transaction[]) {
        this._pendingTransactions = pendingTransactions;
        this.onPendingTransactionsChanged(pendingTransactions);
    }

    getBlockByHash(hash: string | null): MinedBlock | null {
        return Array.from(this.minedBlocks).find(block => block.getHash() === hash) || null;
    }

    generateChainEndingAtBlock(block: MinedBlock): MinedBlock[] {
        const chain: MinedBlock[] = [];
        let currentBlock: MinedBlock | null = block;
        while (currentBlock) {
            chain.push(currentBlock);
            //currentBlock = currentBlock.previousBlock;
            // currentBlock = currentBlock.previousBlock;
            currentBlock = this.getBlockByHash(currentBlock.previousBlockHash);
        }
        chain.reverse();
        return chain;
    }

    getLongestChain(): MinedBlock[] {
        const longestChain: MinedBlock[] = [];
        for (const block of Array.from(this.minedBlocks)) {
            const chain = this.generateChainEndingAtBlock(block);
            if (chain.length > longestChain.length) {
                longestChain.splice(0, longestChain.length);
                longestChain.push(...chain);
            }
        }
        return longestChain;
    };

    addBlockToSet(block: MinedBlock) {
        console.log("adding block to set");
        this._minedBlocks.push(block);

        const mainBlockChain = this.getLongestChain();
        this.minedBlocks = mainBlockChain;
    };

    addBlock(block: MinedBlock, removeFromPending = false) {
        console.log("adding block", block);
        this.addBlockToSet(block);

        let transactionToRemove: Transaction | null = null;

        if (removeFromPending) {
            // setPendingTransactions(prev => prev.filter(t => !block.transactions.includes(t)));
            console.log("pending transactions:", this.pendingTransactions);


            this.pendingTransactions.forEach((pendingTransaction, index) => {
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

        console.log("transaction to remove:", transactionToRemove);
        this.pendingTransactions = this.pendingTransactions.filter(t => !transactionToRemove?.isEqual(t));
    }

    incrementOwnTransactionId() {
        this.ownTransactionId++;
    }

    clearBlocks() {
        this.minedBlocks = [];
    }

    mineBlockFromTransactions(transactions: Transaction[]): MinedBlock {
        const block = new PendingBlock(transactions);
        const latestBlock = this.minedBlocks[this.minedBlocks.length - 1];
        return block.mine(latestBlock ?? null, latestBlock ? latestBlock.getHash() : null);
    }

    getAllTransactionsInChain() {
        const transactions = [];
        for (const block of this.minedBlocks) {
            transactions.push(...block.transactions);
        }
        return transactions;
    }

    getValidTransactions(publicKeys: Map<string, string>) {
        const allTransactions = this.getAllTransactionsInChain();
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

    calculateBalance(publicKeys: Map<string, string>, userId: string) {
        // get all transactions
        if (this.minedBlocks.length === 0) {
            return 0;
        }
        const latestBlock = this.minedBlocks[this.minedBlocks.length - 1];
        // const transactions = latestBlock.getAllTransactionsInChain();
        const transactions = this.getValidTransactions(publicKeys);
        const outgoingTransactions = transactions.filter(transaction => transaction.sender === userId);
        const incomingTransactions = transactions.filter(transaction => transaction.receiver === userId);
        const outgoingAmount = outgoingTransactions.reduce((total, transaction) => total + transaction.amount, 0);
        const incomingAmount = incomingTransactions.reduce((total, transaction) => total + transaction.amount, 0);
        return incomingAmount - outgoingAmount;
    }

}