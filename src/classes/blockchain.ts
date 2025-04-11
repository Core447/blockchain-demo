import { MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction, transactionsFromTransactionsData } from "@/lib/transactions";
import Peer from "peerjs";
import { Connection } from "./connection";
import { Payload } from "@/lib/requester";
import { RequestAllBlocks, ResponseAllBlocks } from "@/lib/messages";
import { sendData } from "@/lib/communication";

export class Blockchain {
    private _minedBlocks: MinedBlock[];
    private _pendingTransactions: Transaction[];
    public _ownTransactionId: number;

    constructor(
        private connection: Connection,
        public onMinedBlocksChanged: (onMinedBlocksChanged: MinedBlock[]) => void,
        public onPendingTransactionsChanged: (pendingTransactions: Transaction[]) => void
    ) {
        this._minedBlocks = [];
        this._pendingTransactions = [];
        this._ownTransactionId = 0;
    }

    triggerOnMinedBlocksChanged() {
        this.onMinedBlocksChanged(this.minedBlocks);
    }

    triggerOnPendingTransactionsChanged() {
        this.onPendingTransactionsChanged(this.pendingTransactions);
    }

    get ownTransactionId(): number {
        return this._ownTransactionId;
    }

    set ownTransactionId(ownTransactionId: number) {
        this._ownTransactionId = ownTransactionId;
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

    setPrevBlockRefs() {
        this.minedBlocks.forEach(block => {
            block.previousBlock = this.getBlockByHash(block.previousBlockHash);
        })
    }

    loadBlocksFromOtherClients() {
        console.log("bbc getting blocks from other clients", this.connection.requesters.size);
        this.connection.requesters.forEach((requester, peerName) => {
            if (peerName == this.connection.peerName) {
                alert("skipping own peer");
            }
            requester.request<Payload<RequestAllBlocks>, Payload<ResponseAllBlocks>>({
                type: "getAllBlocks",
                payload: {
                    blocks: Array.from(this.minedBlocks)
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
                    this.addBlock(block);
                }
                this.setPrevBlockRefs();
            })
        })
    }

    addPendingTransaction(transaction: Transaction) {
        console.log("adding pending transaction", transaction);
        this.pendingTransactions.push(transaction);
        this.triggerOnPendingTransactionsChanged();
    }

    async sendCurrencyToEveryone(privateKey: string) {
        if (!this.connection.peer) { return }
        console.log(`sending to all ${this.connection.connectedCons.length} connections`)
        const amount = Math.round(Math.random() * 1000)
        for (const conn of this.connection.connectedCons) {
            const transaction = new Transaction(this.ownTransactionId, amount, this.connection.peer.id, conn.peer, null)
            this.ownTransactionId++
            await transaction.signTransaction(privateKey)
            console.log("sending:", transaction.getDataWithSignature())
            this.addPendingTransaction(transaction)
            sendData(
                this.connection.peer,
                this.connection.connectedCons,
                transaction.getDataWithSignature(),
                "transaction",
                this.connection.connectedCons.map((c) => c.peer),
            )
        }
    }

    mineLatestTransaction() {
        if (!this.connection.peer) { return }
        const minedBlock = this.mineBlockFromTransactions(this.pendingTransactions.slice(0, 1))

        console.log("mined block:", minedBlock)
        this.addBlock(minedBlock, true)

        sendData(
            this.connection.peer,
            this.connection.connectedCons,
            minedBlock.getData(),
            "block",
            this.connection.connectedCons.map((c) => c.peer),
        )
    }

}