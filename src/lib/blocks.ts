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
        this.transactions = transactions;
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

    async getIsValid(previousBlock: MinedBlock, publicKeys: Map<string, string>): Promise<boolean> {
        // return true;
        return (await Promise.all(
            this.transactions.map(transaction => {
                const publicKey = publicKeys.get(transaction.sender);
                if (!publicKey) {
                    console.error("Could not find public key of sender:", transaction.sender);
                    return false
                };
                console.log("public key of sender:", publicKey);
                return transaction.verifyTransactionSignature(publicKey);
            })
        )).every(isValid => isValid);


        // TODO: The following checks
        // 1. The proof of work is correct
        // 2. Check previous hash
        // 3. Check the uniqueness of indices of transactions
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