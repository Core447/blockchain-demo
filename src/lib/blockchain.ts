import { Block } from "./blocks";
import { Transaction } from "./transactions";

export class Blockchain {
    pendingTransactions: Transaction[];
    blocks: Block[];

    getBlockByHash(hash: string) {
        return this.blocks.find(block => block. === hash);
    }

    

    constructor(pendingTransactions: Transaction[] = [], blocks: Block[] = []) {
        this.pendingTransactions = pendingTransactions;
        this.blocks = blocks;
    }

    addPendingTransaction(transaction: Transaction) {
        this.pendingTransactions.push(transaction);
    }
}