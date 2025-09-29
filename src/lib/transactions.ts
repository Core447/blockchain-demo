import { Data } from "@/app/com/page";
import { clear } from "console";
import { createCleartextMessage, readCleartextMessage, readKey, readPrivateKey, sign, verify } from "openpgp";
import { MinedBlock } from "./blocks";

export interface UnsignedTransactionData {
    transactionId: number;
    amount: number;
    sender: string;
    receiver: string;
}

export interface SignedTransactionData extends UnsignedTransactionData {
    signMessage: string | null;
}

export class Transaction {
    transactionId: number;
    amount: number;
    sender: string;
    receiver: string;
    signMessage: string | null;

    constructor(transactionId: number, amount: number, sender: string, receiver: string, signMessage: string | null = null) {
        this.transactionId = transactionId;
        this.amount = amount;
        this.sender = sender;
        this.receiver = receiver;
        this.signMessage = signMessage;
    }

    getDataWithoutSignature(): UnsignedTransactionData {
        return {
            transactionId: this.transactionId,
            amount: this.amount,
            sender: this.sender,
            receiver: this.receiver
        }
    }

    getDataWithSignature(): SignedTransactionData {
        return {
            transactionId: this.transactionId,
            amount: this.amount,
            sender: this.sender,
            receiver: this.receiver,
            signMessage: this.signMessage
        }
    }

    setIndex(index: number) {
        this.transactionId = index;
    }

    async signTransaction(privateKey: string) {
        const data = this.getDataWithoutSignature();
        const privateKeyObject = await readPrivateKey({ armoredKey: privateKey });
        const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(data) });

        this.signMessage = await sign({
            message: unsignedMessage,
            signingKeys: [privateKeyObject],
        });
    }

    async verifyTransactionSignature(publicKey: string): Promise<boolean> {
        if (!this.signMessage) {
            console.log("false: no signature");
            return false;
        }
        const data = this.getDataWithoutSignature();
        const publicKeyObject = await readKey({ armoredKey: publicKey });
        const cleartextMessage = await readCleartextMessage({ cleartextMessage: this.signMessage });
    
        if (cleartextMessage.getText() != JSON.stringify(data)) {
            console.log("false: text not equal");
            console.log("cleartextMessage: ", cleartextMessage.getText());
            console.log("data: ", JSON.stringify(data));
            return false;
        }
    
        const verificationResult = await verify({
            message: cleartextMessage,
            verificationKeys: [publicKeyObject],
        });
    
        // Each signature in the verification result has a "verified" property
        let verified = false;
        try {
            verified = await verificationResult.signatures[0].verified;
        } catch (e) {
            console.log(e);
        }
    
        // Verify the content of the transaction is the same that was signed
        if (verified) {
            // const unsignedMessage = await createCleartextMessage({ text: JSON.stringify(data) });
            console.log("signedText: ", cleartextMessage.getText());
            return cleartextMessage.getText() == JSON.stringify(data);
        }
    
        console.log("false: not verified");
        return false;
    }

    isEqual(transaction: Transaction) {
        if (this.amount != transaction.amount) {
            console.log("amount not equal");
            return false;
        }
        if (this.sender != transaction.sender) {
            console.log("sender not equal");
            return false;
        }
        if (this.receiver != transaction.receiver) {
            console.log("receiver not equal");
            return false;
        }
        return true;
        // return (this.index == transaction.index && this.amount == transaction.amount && this.sender == transaction.sender && this.receiver == transaction.receiver);
    }

    checkIfIndexIsUnique(previousTransactionsOfUser: Transaction[]) {
        const indices = [...previousTransactionsOfUser, this].map(transaction => transaction.transactionId);
        return indices.length == new Set(indices).size;
    }

    async isValid(publicKeys: Map<string, string>, previousTransactionsOfUser: Transaction[], blockOfTransaction: MinedBlock | null) {
        // special case: system transactions (used for block rewards)
        if (this.sender == "system") {
            if (!blockOfTransaction) {
                return false;
            }
            if (this.amount != 50) {
                return false;
            }
            if (this.transactionId != 0) {
                return false;
            }
            if (this.signMessage) {
                return false;
            }

            // now verify that this is the first block reward transaction in the block
            for (const transaction of blockOfTransaction.transactions) {
                if (transaction == this) {
                    break;
                }
                if (transaction.sender == "system") {
                    return false;
                }
            }

            return true;
        }

        
        console.log("checking with n previous transactions:", previousTransactionsOfUser.length);
        if (!this.checkIfIndexIsUnique(previousTransactionsOfUser)) {
            console.log("false: index not unique, index: ", this.transactionId);
            return false;
        }
        if (!this.sender) {
            console.log("false: no sender");
            return false;
        }
        const publicKey = publicKeys.get(this.sender);
        if (!publicKey) {
            console.log("false: no public key");
            return false;
        }
        if (!await this.verifyTransactionSignature(publicKey)) {
            console.log("false: signature not valid");
            return false;
        }
        console.log("true");
        return true;
    }
}

export function transactionsFromTransactionsData(transactionsData: SignedTransactionData[]): Transaction[] {
    return transactionsData.map(transaction => new Transaction(transaction.transactionId, transaction.amount, transaction.sender, transaction.receiver, transaction.signMessage));
}