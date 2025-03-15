import { Data } from "@/app/com/page";
import { clear } from "console";
import { createCleartextMessage, readCleartextMessage, readKey, readPrivateKey, sign, verify } from "openpgp";

export interface UnsignedTransactionData {
    index: number;
    amount: number;
    sender: string;
    receiver: string;
}

export interface SignedTransactionData extends UnsignedTransactionData {
    signMessage: string | null;
}

export class Transaction {
    index: number;
    amount: number;
    sender: string;
    receiver: string;
    signMessage: string | null;

    constructor(index: number, amount: number, sender: string, receiver: string, signMessage: string | null = null) {
        this.index = index;
        this.amount = amount;
        this.sender = sender;
        this.receiver = receiver;
        this.signMessage = signMessage;
    }

    getDataWithoutSignature(): UnsignedTransactionData {
        return {
            index: this.index,
            amount: this.amount,
            sender: this.sender,
            receiver: this.receiver
        }
    }

    getDataWithSignature(): SignedTransactionData {
        return {
            index: this.index,
            amount: this.amount,
            sender: this.sender,
            receiver: this.receiver,
            signMessage: this.signMessage
        }
    }

    setIndex(index: number) {
        this.index = index;
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
        const indices = [...previousTransactionsOfUser, this].map(transaction => transaction.index);
        return indices.length == new Set(indices).size;
    }

    isValid(publicKeys: Map<string, string>, previousTransactionsOfUser: Transaction[]) {
        console.log("checking with n previous transactions:", previousTransactionsOfUser.length);
        if (!this.checkIfIndexIsUnique(previousTransactionsOfUser)) {
            console.log("false: index not unique, index: ", this.index);
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
        if (!this.verifyTransactionSignature(publicKey)) {
            console.log("false: signature not valid");
            return false;
        }
        console.log("true");
        return true;
    }
}

export function transactionsFromTransactionsData(transactionsData: SignedTransactionData[]): Transaction[] {
    return transactionsData.map(transaction => new Transaction(transaction.index, transaction.amount, transaction.sender, transaction.receiver, transaction.signMessage));
}