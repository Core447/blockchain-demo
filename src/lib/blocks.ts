import { Transaction } from "./transactions";
import { createHash } from "crypto";

export interface BlockData {
    transactions: Transaction[];
}

export interface MinedBlockData extends BlockData {
    previousHash: string | null;
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

    getHash(): string {
        return createHash('sha256').update(JSON.stringify(this.getData())).digest('hex');
    }
}

export class MinedBlock extends Block {
    previousBlockHash: string | null;
    previousBlock: MinedBlock | null;
    proofOfWork: number;

    constructor(previousBlock: MinedBlock | null, previousBlockHash: string | null, proofOfWork: number, transactions: Transaction[]) {
        super(transactions);
        this.previousBlock = previousBlock;
        this.proofOfWork = proofOfWork;
        this.previousBlockHash = previousBlockHash;
    }

    async isHashValid(): Promise<boolean> {
        return this.getHash().startsWith("000");
    }

    async areTransactionsValid(publicKeys: Map<string, string>): Promise<boolean> {
        const getTransactionsBeforeThisBlock = this.getAllTransactionsBeforeThisBlock();

        const sendersInThisBlock = Array.from(new Set(this.transactions.map(transaction => transaction.sender)));

        for (const sender of sendersInThisBlock) {
            const previousTransactionsOfUser = getTransactionsBeforeThisBlock.filter(transaction => transaction.sender === sender);
            const senderTransactionsOfThisBlock = this.transactions.filter(transaction => transaction.sender === sender);
            for (const transaction of senderTransactionsOfThisBlock) {
                if (!(await transaction.isValid(publicKeys, previousTransactionsOfUser))) {
                    return false;
                }
                previousTransactionsOfUser.push(transaction);
            }
        }

        return true;
    }

    async getIsValid(publicKeys: Map<string, string>): Promise<boolean> {
        // Check hash
       if (!await this.isHashValid()) {
           return false;
       }

       if(!await this.areTransactionsValid(publicKeys)) {
        return false;
       }

       


        return true;



        // return true;
        if (!(await Promise.all(
            this.transactions.map(transaction => {
                const publicKey = publicKeys.get(transaction.sender);
                if (!publicKey) {
                    console.error("Could not find public key of sender:", transaction.sender);
                    return false
                };
                console.log("public key of sender:", publicKey);
                return transaction.verifyTransactionSignature(publicKey);
            })
        )).every(isValid => isValid)) {
            return false;
        }

        // if (!this.getAreIndicesUnique()) {
        //     return false;
        // }

        // Check transaction uniqueness
        const senders = Array.from(new Set(this.transactions.map(transaction => transaction.sender)));
        for (const sender of senders) {
            const transactions = this.getTransactionsOfUserInChain(sender);
            if (!transactions.every(transaction => transaction.checkIfIndexIsUnique(transactions))) {
                return false;
            }
        }

        
        // TODO: The following checks
        // 1. The proof of work is correct
        // 2. Check previous hash
        // 3. Check the uniqueness of indices of transactions
        return true;
    }
    
    // getAreIndicesUnique(): boolean {
    //     const senders = Array.from(new Set(this.transactions.map(transaction => transaction.sender)));

    //     for (const sender of senders) {
    //         const indices = this.getIndicesOfTransactionsOfUserInChain(sender);
    //         console.log(`We have ${indices.length} indices for ${sender}`);
    //         if (indices.length !== new Set(indices).size) {
    //             return false;
    //         }
    //     }

    //     return true;
    // }
    

    getData(): MinedBlockData {
        return {
            ...super.getData(),
            previousHash: this.previousBlockHash,
            proofOfWork: this.proofOfWork
        }
    }

    // getIndicesOfTransactionsOfUserInChain(userId: string): number[] {
    //     const matchingTransactionsOfThisBlock = this.transactions.filter(transaction => transaction.sender === userId);
    //     const indices = matchingTransactionsOfThisBlock.map(transaction => transaction.index);

    //     if (this.previousBlock) {
    //         console.log("We ahve a previous block");
    //     } else {
    //         console.log("No previous block");
    //     }
        
    //     const indicesBeforeThisBlock = this.previousBlock ? this.previousBlock.getIndicesOfTransactionsOfUserInChain(userId) : [];
    //     return [...indicesBeforeThisBlock, ...indices];
    // }

    getTransactionsOfUserInChain(userId: string): Transaction[] {
        const matchingTransactionsOfThisBlock = this.transactions.filter(transaction => transaction.sender === userId);
        const transactionsBeforeThisBlock = this.previousBlock ? this.previousBlock.getTransactionsOfUserInChain(userId) : [];
        return [...transactionsBeforeThisBlock, ...matchingTransactionsOfThisBlock];
    }

    getAllTransactionsBeforeThisBlock(): Transaction[] {
        return this.previousBlock ? this.previousBlock.getAllTransactionsInChain() : [];
    }

    getAllTransactionsInChain(): Transaction[] {
        console.log("prev", this.previousBlock);
        if (this.previousBlock == this) {
            // should not happen
            return [];
        }
        const transactionsBeforeThisBlock = this.previousBlock ? this.previousBlock.getAllTransactionsInChain() : [];
        return [...transactionsBeforeThisBlock, ...this.transactions];
    }
}

export class PendingBlock extends Block {
    mine(previousBlock: MinedBlock | null, previousBlockHash: string | null): MinedBlock {
        let proofOfWork = 0;
        let minedBlock = new MinedBlock(previousBlock, previousBlockHash, proofOfWork, this.transactions);
        while (!minedBlock.getHash().startsWith("000")) {
            proofOfWork++;
            minedBlock = new MinedBlock(previousBlock, previousBlockHash, proofOfWork, this.transactions);
        }

        return minedBlock;
    }
}