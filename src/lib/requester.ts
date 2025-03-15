import { DataConnection } from "peerjs";

export interface Payload<T = unknown> {
    type: string;
    payload: T;
}

export interface RRMessage<T = unknown> { // Request Response Message = RRMessage
    type: 'request' | 'response';
    payloadType?: string;
    requestId: number;
    payload: T;
    error?: string;
}

interface PendingRequest<T> {
    resolve: (value: T) => void;
    reject: (reason?: Error) => void;
}

export class PeerRequester {
    private connection: DataConnection;
    private pendingRequests: Map<number, PendingRequest<unknown>>;
    private requestId: number;

    constructor(connection: DataConnection) {
        this.connection = connection;
        this.pendingRequests = new Map();
        this.requestId = 0;

        // Listen for responses
        this.connection.on('data', (dataU: unknown) => {
            const data = dataU as RRMessage;
            if (data.type === 'response' && this.pendingRequests.has(data.requestId)) {
                const pendingRequest = this.pendingRequests.get(data.requestId)!;
                pendingRequest.resolve(data.payload);
                this.pendingRequests.delete(data.requestId);
            }
        });
    }

    // Generic method to send request and wait for response
    async request<TRequest, TResponse>(payload: TRequest): Promise<TResponse> {
        const requestId = this.requestId++;
        
        return new Promise<TResponse>((resolve, reject) => {
            // Store the promise resolver
            this.pendingRequests.set(requestId, {
                resolve: resolve as (value: unknown) => void,
                reject
            });

            // Send the request
            this.connection.send({
                type: 'request',
                requestId,
                payload
            } satisfies RRMessage<TRequest>);

            // Timeout after 5 seconds
            setTimeout(() => {
                if (this.pendingRequests.has(requestId)) {
                    const pendingRequest = this.pendingRequests.get(requestId)!;
                    pendingRequest.reject(new Error('Request timed out'));
                    this.pendingRequests.delete(requestId);
                }
            }, 5000);
        });
    }

    // Method to handle incoming requests with type safety
    onRequest<TRequest, TResponse>(
        handler: (payload: TRequest) => Promise<TResponse> | TResponse
    ): void {
        this.connection.on('data', async (dataU: unknown) => {
            const data = dataU as RRMessage<TRequest>;
            if (data.type === 'request') {
                try {
                    const response = await handler(data.payload);
                    this.connection.send({
                        type: 'response',
                        requestId: data.requestId,
                        payload: response
                    } satisfies RRMessage<TResponse>);
                } catch (error) {
                    this.connection.send({
                        type: 'response',
                        requestId: data.requestId,
                        error: error instanceof Error ? error.message : 'Unknown error',
                        payload: null
                    } satisfies RRMessage<null>);
                }
            }
        });
    }
}