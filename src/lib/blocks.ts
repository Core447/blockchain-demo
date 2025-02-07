import { Transaction } from "./transactions";

export interface BlockData {
    transactions: Transaction[];
}

export interface MinedBlockData extends BlockData {
    previousHash: string;
    proofOfWork: number;
}

export class Block {
    transactions: Transaction[];
    
    constructor(transactions: Transaction[]) {
        this.transactions = this.getIndexedTransactions(transactions);
    }
    
    getIndexedTransactions(transactions: Transaction[]): Transaction[] {
        return transactions.map((transaction, index) => {
            transaction.index = index;
            return transaction;
        });
    }

    getData(): BlockData {
        return {
            transactions: this.transactions
        }
    }
}

export class MinedBlock extends Block {
    previousHash: string;
    proofOfWork: number;

    constructor(previousHash: string, proofOfWork: number, transactions: Transaction[]) {
        super(transactions);
        this.previousHash = previousHash;
        this.proofOfWork = proofOfWork;
    }

    getIsValid(previousBlock: MinedBlock): boolean {
        return true;
    }

    getData(): MinedBlockData {
        return {
            ...super.getData(),
            previousHash: this.previousHash,
            proofOfWork: this.proofOfWork
        }
    }
}

export class PendingBlock extends Block {
    mine(previousHash: string): MinedBlock {
        return new MinedBlock(previousHash, 1234, this.transactions);
    }
}