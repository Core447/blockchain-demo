import { SignedTransaction } from "./transactions";

export class Block {
    transactions: SignedTransaction[];
    
    constructor(transactions: SignedTransaction[]) {
        this.transactions = this.getIndexedTransactions(transactions);
    }
    
    getIndexedTransactions(transactions: SignedTransaction[]): SignedTransaction[] {
        return transactions.map((transaction, index) => {
            transaction.transaction.index = index;
            return transaction;
        });
    }
}

export class MinedBlock extends Block {
    previousHash: string;
    proofOfWork: number;

    constructor(previousHash: string, proofOfWork: number, transactions: SignedTransaction[]) {
        super(transactions);
        this.previousHash = previousHash;
        this.proofOfWork = proofOfWork;
    }
}

export class PendingBlock extends Block {
    mine(previousHash: string): MinedBlock {
        return new MinedBlock(previousHash, 1234, this.transactions);
    }
}