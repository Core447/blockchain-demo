import { Packet } from "@/app/com/page";
import { Payload, PeerRequester } from "@/lib/requester";
import Peer, { DataConnection } from "peerjs";
import { adjectives, animals, colors, uniqueNamesGenerator } from "unique-names-generator";

export class Connection {
    _peer: Peer | null = null;
    _connectedCons: DataConnection[] = [];
    _peerName: string = "";
    _requesters: Map<string, PeerRequester> = new Map();
    dataHandlers: ((packet: Packet) => void)[] = [];
    _rrHandlers: Map<string, (payload: Payload) => Payload> = new Map();
    handledConnections: Set<string> = new Set();

    constructor(
        public onConnectedConsChanged: (connectedCons: DataConnection[]) => void,
        public onPeerNameChanged: (peerName: string) => void,
        public onPeerChanged: (peer: Peer) => void,
        public onRRHandlersChanged: (rrHandlers: Map<string, (payload: Payload) => Payload>) => void,
        public onRequestersChanged: (requesters: Map<string, PeerRequester>) => void,
    ) {
        try {
            if (window) {
                console.log("window exists");
            }
        }
        catch (e) {
            console.log("window does not exist");
            return;
        }
        this.peerName = this.generateRandomPeerName();
        this.peer = this.setupPeer(this.peerName);
    }

    get peer(): Peer | null {
        return this._peer;
    }

    get peerName(): string {
        return this._peerName;
    }

    set peerName(peerName: string) {
        this._peerName = peerName;
        this.onPeerNameChanged(peerName);
    }

    set peer(peer: Peer) {
        this._peer = peer;
        this.onPeerChanged(peer);
    }

    get connectedCons(): DataConnection[] {
        return this._connectedCons;
    }

    get rrHandlers(): Map<string, (payload: Payload) => Payload> {
        return this._rrHandlers;
    }

    set rrHandlers(rrHandlers: Map<string, (payload: Payload) => Payload>) {
        this._rrHandlers = rrHandlers;
        this.onRRHandlersChanged(rrHandlers);
    }

    set connectedCons(connectedCons: DataConnection[]) {
        this._connectedCons = connectedCons;
        this.onConnectedConsChanged(connectedCons);
    }

    get requesters(): Map<string, PeerRequester> {
        return this._requesters;
    }

    set requesters(requesters: Map<string, PeerRequester>) {
        this._requesters = requesters;
        this.onRequestersChanged(requesters);
    }

    async load() {
        if (!this.peer) {
            console.error("Peer is not initialized");
            return;
        }

        const loadConnections = async () => {
            try {
                const initialOtherPeerNames = await this.getOtherPeerNames();
                initialOtherPeerNames.forEach((otherPeerName) => {
                    // Only create a connection if we haven't handled it yet
                    if (!this.handledConnections.has(otherPeerName)) {
                        const conn = this.peer!.connect(otherPeerName, {
                            reliable: true,
                        });
                        this.setupConnectionHandlers(conn);
                    }
                });
            } catch (error) {
                console.error("Error loading connections:", error);
            }
        }
        
        // Only load connections after peer is open
        if (this.peer.open) {
            loadConnections();
        } else {
            this.peer.on("open", loadConnections);
        }

        // Set up the connection listener only once
        this.peer.on("connection", (conn: DataConnection) => {
            this.setupConnectionHandlers(conn);
        }
        );
    }

    async updateConnections() {
        console.log("Updating connections...");
        const activePeers = await this.getOtherPeerNames();
        this.connectedCons = this.connectedCons.filter(conn => {
            const isPeerActive = activePeers.includes(conn.peer);
            const isConnectionOpen = conn.open;
            
            if (!isPeerActive || !isConnectionOpen) {
                console.log(`Removing disconnected peer: ${conn.peer}`);
                this.handledConnections.delete(conn.peer);
                conn.close();
                return false;
            }
            return true;
        });
    }

    generateRandomPeerName(): string {
        return uniqueNamesGenerator({
            dictionaries: [adjectives, animals, colors],
            length: 2
        });
    }

    setupPeer(peerName: string): Peer {
        const newPeer = new Peer(peerName, {
            host: process.env.NEXT_PUBLIC_PEERJS_SERVER_IP,
            port: parseInt(process.env.NEXT_PUBLIC_PEERJS_SERVER_PORT!),
            path: "/blockchain",
            debug: 3,
            secure: process.env.NEXT_PUBLIC_PEERJS_SERVER_SECURE === "true",
        });

        newPeer.on("open", () => {
            console.log(`Peer opened with ID: ${newPeer.id}`);
        });

        newPeer.on("error", (err) => {
            console.error("Peer error:", err);
        });

        newPeer.on("disconnected", () => {
            console.log("Peer disconnected. Attempting to reconnect...");
            newPeer.reconnect();
        });

        return newPeer;
    }

    addDataHandler(handler: (packet: Packet) => void) {
        this.dataHandlers.push(handler);
    }

    addRRHandler(payloadType: string, handler: (payload: Payload) => Payload) {
        this.rrHandlers.set(payloadType, handler);
    }

    async getOtherPeerNames(): Promise<string[]> {
        const protocol = process.env.NEXT_PUBLIC_PEERJS_SERVER_SECURE === "true" ? "https" : "http";
        const port = process.env.NEXT_PUBLIC_PEERJS_SERVER_PORT ? `:${process.env.NEXT_PUBLIC_PEERJS_SERVER_PORT}` : "";
        const response = await fetch(`${protocol}://${process.env.NEXT_PUBLIC_PEERJS_SERVER_IP}${port}/blockchain/peerjs/peers`);
        const data = await response.json();
        return data.filter((p: string) => p !== this.peerName);
    }

    addConnection(conn: DataConnection) {
        this.connectedCons.push(conn);
    }

    async sendRRMessage<TRequest, TResponse>(peerName: string, payload: TRequest): Promise<TResponse> {
        const requester = this.requesters.get(peerName);
        if (requester) {
            const response = await requester.request<TRequest, TResponse>(payload);
            return response;
        }
        throw new Error(`No connection to ${peerName}`);
    }

    setupConnectionHandlers(conn: DataConnection) {
            // Check if we've already set up handlers for this connection
            if (this.handledConnections.has(conn.peer)) {
                return;
            }
    
            // Mark this connection as handled
            this.handledConnections.add(conn.peer);
    
            conn.on("open", () => {
                console.log(`Connection opened with ${conn.peer}`);
                const requester = new PeerRequester(conn);
                requester.onRequest<Payload, Payload>((payload) => {
                    // find handler
                    console.log("Received request", payload);
                    const handler = this.rrHandlers.get(payload.type);
                    if (handler) {
                        return handler(payload);
                    }
                    console.error("No handler found for", payload.type);
                    throw new Error(`No handler for ${payload.type}`);
                })
                console.log("bbc adding requester")
                this.requesters.set(conn.peer, requester);
                console.log("bbc n", this.requesters.size)
                this.addConnection(conn);
            });
    
            conn.on("data", (data) => {
                console.log(`Received data from ${conn.peer}:`, data);
                const receivedPacket = data as Packet;
                console.log("Calling handlers", this.dataHandlers.length);
                this.dataHandlers.forEach((handler) => handler(receivedPacket));
            });
    
            conn.on("close", () => {
                console.log(`Connection closed with ${conn.peer}`);
                this.handledConnections.delete(conn.peer);
                this.connectedCons = this.connectedCons.filter(c => c.peer !== conn.peer);
                // Remove the requesters for this connection
                this.requesters.delete(conn.peer);
            });
    
            conn.on("error", (err) => {
                console.error(`Connection error with ${conn.peer}:`, err);
                this.handledConnections.delete(conn.peer);
                this.connectedCons = this.connectedCons.filter(c => c.peer !== conn.peer);
            });
    
        }
}