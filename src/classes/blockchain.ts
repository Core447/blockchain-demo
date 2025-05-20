import { MinedBlock, PendingBlock } from "@/lib/blocks";
import { Transaction, transactionsFromTransactionsData } from "@/lib/transactions";
import Peer from "peerjs";
import { Connection } from "./connection";
import { Payload } from "@/lib/requester";
import { RequestAllBlocks, ResponseAllBlocks } from "@/lib/messages";
import { sendData } from "@/lib/communication";
import { PGP } from "./pgp";
import { generateKey } from "openpgp";

export class Blockchain {
    private _minedBlocks: MinedBlock[];
    private _pendingTransactions: Transaction[];
    public _ownTransactionId: number;

    constructor(
        // private pgp: PGP,
        private connection: Connection,
        public onMinedBlocksChanged: (onMinedBlocksChanged: MinedBlock[]) => void,
        public onPendingTransactionsChanged: (pendingTransactions: Transaction[]) => void
    ) {
        this._minedBlocks = [];
        this._pendingTransactions = [];
        this._ownTransactionId = 0;


        this.connection.addRRHandler("getAllBlocks", (r) => {
            console.log("sending all blocks")
            const blocks = this.minedBlocks.map((block) => block.getData())

            console.log("sending all blocks", blocks)

            return {
                type: "allBlocks",
                payload: {
                    blocks,
                },
            }
        })
    }

    triggerOnMinedBlocksChanged() {
        this.onMinedBlocksChanged(this.minedBlocks);
    }

    triggerOnPendingTransactionsChanged() {
        console.log("triggerOnPendingTransactionsChanged", this.pendingTransactions);
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
        if (!hash) {
            console.log("No hash provided to getBlockByHash");
            return null;
        }

        console.log("Looking for block with hash:", hash);
        const block = this._minedBlocks.find(block => block.getHash() === hash);

        if (block) {
            console.log("Found block with hash:", hash);
        } else {
            console.log("Block with hash not found:", hash);
        }

        return block || null;
    }

    generateChainEndingAtBlock(block: MinedBlock): MinedBlock[] {
        console.log("Generating chain ending at block", block.getHash());
        const chain: MinedBlock[] = [];
        let currentBlock: MinedBlock | null = block;

        // Add the current block to the chain
        chain.push(currentBlock);

        // Follow the previous block references until we reach the genesis block
        while (currentBlock && currentBlock.previousBlockHash) {
            currentBlock = this.getBlockByHash(currentBlock.previousBlockHash);
            if (currentBlock) {
                chain.push(currentBlock);
            } else {
                console.warn("Could not find previous block with hash:", currentBlock?.previousBlockHash);
                break;
            }
        }

        // Reverse the chain so it starts with the genesis block
        chain.reverse();
        console.log("Generated chain with", chain.length, "blocks");
        return chain;
    }

    getLongestChain(): MinedBlock[] {
        console.log("Finding longest chain from", this._minedBlocks.length, "blocks");

        if (this._minedBlocks.length === 0) {
            console.log("No blocks in blockchain");
            return [];
        }

        const longestChain: MinedBlock[] = [];
        for (const block of Array.from(this._minedBlocks)) {
            const chain = this.generateChainEndingAtBlock(block);
            console.log("Chain ending at block", block.getHash(), "has length", chain.length);
            if (chain.length > longestChain.length) {
                longestChain.splice(0, longestChain.length);
                longestChain.push(...chain);
            }
        }

        console.log("Longest chain has", longestChain.length, "blocks");
        return longestChain;
    }

    addBlockToSet(block: MinedBlock) {
        console.log("adding block to set");

        // Check if the block already exists in the blockchain
        const existingBlock = this._minedBlocks.find(b => b.getHash() === block.getHash());
        if (existingBlock) {
            console.log("Block already exists in blockchain, skipping");
            return;
        }

        this._minedBlocks.push(block);

        const mainBlockChain = this.getLongestChain();
        console.log("Longest chain length:", mainBlockChain.length);
        this.minedBlocks = mainBlockChain;
    }

    addBlock(block: MinedBlock, removeFromPending = false) {
        console.log("adding block", block);
        this.addBlockToSet(block);

        if (removeFromPending) {
            console.log("Removing transactions from pending that are now in the block");
            console.log("Pending transactions before:", this.pendingTransactions);
            console.log("Block transactions:", block.transactions);

            // Create a new array of pending transactions that don't match any in the block
            const updatedPendingTransactions = this.pendingTransactions.filter(pendingTransaction => {
                // Check if this pending transaction is in the block
                const isInBlock = block.transactions.some(blockTransaction =>
                    pendingTransaction.isEqual(blockTransaction)
                );

                if (isInBlock) {
                    console.log("Removing transaction from pending:", pendingTransaction);
                }

                return !isInBlock;
            });

            console.log("Pending transactions after:", updatedPendingTransactions);
            this.pendingTransactions = updatedPendingTransactions;
        }
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

    async getValidTransactions(publicKeys: Map<string, string>) {
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
                if (await transaction.isValid(publicKeys, previousTransactionsOfUser)) {
                    validTransactions.push(transaction);
                    previousTransactionsOfUser.push(transaction);
                }
            }
        }

        return validTransactions;
    }

    getAllTransactionsFromUser(userId: string) {
        const allTransactions = this.getAllTransactionsInChain();
        return allTransactions.filter(transaction => transaction.sender === userId || transaction.receiver === userId);
    }

    getMaxTransactionIdOfUser(userId: string) {
        const transactions = this.getAllTransactionsFromUser(userId);
        return transactions.reduce((max, transaction) => Math.max(max, transaction.transactionId), 0);
    }

    async calculateBalance(publicKeys: Map<string, string>, userId: string) {
        // get all transactions
        if (this.minedBlocks.length === 0) {
            return 0;
        }
        const latestBlock = this.minedBlocks[this.minedBlocks.length - 1];
        // const transactions = latestBlock.getAllTransactionsInChain();
        const transactions = await this.getValidTransactions(publicKeys);
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
        this.pendingTransactions = [...this.pendingTransactions, transaction]; // can't use push because it mutates the array which means the state won't pick up the change
        this.triggerOnPendingTransactionsChanged();
    }

    async sendMoney(receiver: string, amount: number, privateKey: string) {
        if (!this.connection.peer) {
            console.warn("No peer connection available");
            return;
        }
        const transaction = new Transaction(this.ownTransactionId, amount, this.connection.peer.id, receiver, null);
        this.ownTransactionId++;
        await transaction.signTransaction(privateKey);
        this.addPendingTransaction(transaction);
        sendData(
            this.connection.peer,
            this.connection.connectedCons,
            transaction.getDataWithSignature(),
            "transaction",
            this.connection.connectedCons.map((c) => c.peer),
        );
    }

    async sendMoneyInTheNameOfSomeone(sender: string, receiver: string, amount: number) {
        if (!this.connection.peer) {
            console.warn("No peer connection available");
            return;
        }

        // we don't have the real private key of the sender, so we create a fake one
        const { privateKey } = await generateKey({
            userIDs: [{ name: this.connection.peerName }],
        })

        // get transactionId from sender
        const senderTransactionId = this.getMaxTransactionIdOfUser(sender);
        const transaction = new Transaction(senderTransactionId + 1, amount, this.connection.peer.id, receiver, null);

        await transaction.signTransaction(privateKey);
        this.addPendingTransaction(transaction);
        sendData(
            this.connection.peer,
            this.connection.connectedCons,
            transaction.getDataWithSignature(),
            "transaction",
            this.connection.connectedCons.map((c) => c.peer),
        );
    }

    async sendCurrencyToEveryone(privateKey: string) {
        if (!this.connection.peer) {
            console.warn("No peer connection available");
            return;
        }

        console.log(`Sending currency to all ${this.connection.connectedCons.length} connections`);

        // Only proceed if there are connected clients
        if (this.connection.connectedCons.length === 0) {
            console.warn("No connected clients to send currency to");
            return;
        }

        const amount = Math.round(Math.random() * 1000);
        console.log(`Generated random amount: ${amount}`);

        // Create and sign transactions for each connected client
        for (const conn of this.connection.connectedCons) {
            this.sendMoney(conn.peer, amount, privateKey);
        };
    }

    mineLatestTransaction() {
        if (!this.connection.peer) { return }
        const minedBlock = this.mineBlockFromTransactions(this.pendingTransactions.slice(0, 1))

        console.log("mined block:", minedBlock)

        // Add the block to our blockchain
        this.addBlock(minedBlock, true);

        // Broadcast the mined block to all connected clients
        if (this.connection.connectedCons.length > 0) {
            console.log("Broadcasting mined block to all connected clients");
            sendData(
                this.connection.peer,
                this.connection.connectedCons,
                minedBlock.getData(),
                "block",
                this.connection.connectedCons.map((c) => c.peer),
            );
        }
    }

}