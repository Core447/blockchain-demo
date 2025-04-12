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
    _isDestroyed: boolean = false;
    toCallWhenLoaded: (() => void)[] = [];
    isLoaded: boolean = false;
    toCallOnNewConnections: (() => void)[] = [];

    constructor(
        public onConnectedConsChanged: (connectedCons: DataConnection[]) => void,
        public onPeerNameChanged: (peerName: string) => void,
        public onPeerChanged: (peer: Peer) => void,
        public onRRHandlersChanged: (rrHandlers: Map<string, (payload: Payload) => Payload>) => void,
        public onRequestersChanged: (requesters: Map<string, PeerRequester>) => void,
    ) {
        // Check if we're in a browser environment
        if (typeof window === 'undefined') {
            console.log("Not in browser environment, skipping peer initialization");
            return;
        }
        
        this.peerName = this.generateRandomPeerName();
        this.peer = this.setupPeer(this.peerName);
    }

    addToCallWhenLoaded(callback: () => void) {
        if (this._isDestroyed) {
            return;
        }
        this.toCallWhenLoaded.push(callback);
        if (this.isLoaded) {
            callback();
        }
    }

    addToCallOnNewConnections(callback: () => void) {
        if (this._isDestroyed) {
            return;
        }
        this.toCallOnNewConnections.push(callback);
    }

    triggerOnPeerNameChanged() {
        this.onPeerNameChanged(this.peerName);
    }

    triggerOnPeerChanged() {
        this.onPeerChanged(this.peer!);
    }

    triggerOnConnectedConsChanged() {
        this.onConnectedConsChanged(this.connectedCons);
    }

    triggerOnRRHandlersChanged() {
        this.onRRHandlersChanged(this.rrHandlers);
    }
    triggerOnRequestersChanged() {
        this.onRequestersChanged(this.requesters);
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
        if (!this.peer || this._isDestroyed) {
            console.error("Peer is not initialized or connection is destroyed");
            return;
        }

        const loadConnections = async () => {
            if (this._isDestroyed) return;

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
            await loadConnections();
        } else {
            this.peer.on("open", loadConnections);
        }

        // Set up the connection listener only once
        this.peer.on("connection", (conn: DataConnection) => {
            if (!this._isDestroyed) {
                this.setupConnectionHandlers(conn);
            }
        });

        this.isLoaded = true;
        this.toCallWhenLoaded.forEach(callback => callback());
        // this.toCallWhenLoaded = [];
    }

    // Method to properly destroy the connection and clean up resources
    destroy() {
        this._isDestroyed = true;
        
        // Close all connections
        this.connectedCons.forEach(conn => {
            if (conn.open) {
                conn.close();
            }
        });
        
        // Clear all collections
        this.connectedCons = [];
        this.handledConnections.clear();
        this.requesters.clear();
        this.dataHandlers = [];
        this._rrHandlers.clear();
        
        // Destroy the peer
        if (this.peer) {
            this.peer.destroy();
            this._peer = null;
        }
    }

    async updateConnections() {
        if (this._isDestroyed) return;

        const oldConnectedConsIds = this.connectedCons.map(conn => conn.peer);
        
        try {
            const activePeers = await this.getOtherPeerNames();
            // console.log("Active peers:", activePeers);
            
            // Filter out connections that are no longer active
            const updatedConnections = this.connectedCons.filter(conn => {
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
            
            // Update the connections list
            if (updatedConnections.length !== this.connectedCons.length) {
                console.log(`Connection count changed: ${this.connectedCons.length} -> ${updatedConnections.length}`);
                this.connectedCons = updatedConnections;
            }
            
            // Try to connect to any active peers we're not connected to yet
            for (const peerName of activePeers) {
                if (!this.handledConnections.has(peerName) && !this.connectedCons.some(conn => conn.peer === peerName)) {
                    console.log(`Attempting to connect to new peer: ${peerName}`);
                    const conn = this.peer!.connect(peerName, {
                        reliable: true,
                    });
                    this.setupConnectionHandlers(conn);
                }
            }
        } catch (error) {
            console.error("Error updating connections:", error);
        }

        const newConnectedConsIds = this.connectedCons.map(conn => conn.peer);

        const haveConnectionsChanged = newConnectedConsIds.length !== oldConnectedConsIds.length ||
            !newConnectedConsIds.every((peerId, index) => peerId === oldConnectedConsIds[index]);

        if (haveConnectionsChanged) {
            console.log("Connections have changed.", this.connectedCons);
        }

        console.log("old", oldConnectedConsIds, "new", newConnectedConsIds);



        this.triggerOnConnectedConsChanged();
        this.triggerOnRRHandlersChanged();
        this.triggerOnRequestersChanged();
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
            if (!this._isDestroyed) {
                console.log(`Peer opened with ID: ${newPeer.id}`);
            }
        });

        newPeer.on("error", (err) => {
            console.error("Peer error:", err);
        });

        newPeer.on("disconnected", () => {
            if (!this._isDestroyed) {
                console.log("Peer disconnected. Attempting to reconnect...");
                newPeer.reconnect();
            }
        });

        return newPeer;
    }

    addDataHandler(handler: (packet: Packet) => void) {
        console.log("Adding data handler, current count:", this.dataHandlers.length);
        this.dataHandlers.push(handler);
        console.log("Data handler added, new count:", this.dataHandlers.length);
    }

    addRRHandler(payloadType: string, handler: (payload: Payload) => Payload) {
        console.log("Adding RR handler, current count:", this.rrHandlers.size);
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
        if (this._isDestroyed) {
            throw new Error("Connection is destroyed");
        }
        
        const requester = this.requesters.get(peerName);
        if (requester) {
            const response = await requester.request<TRequest, TResponse>(payload);
            return response;
        }
        throw new Error(`No connection to ${peerName}`);
    }

    setupConnectionHandlers(conn: DataConnection) {
        // Check if we've already set up handlers for this connection
        if (this.handledConnections.has(conn.peer) || this._isDestroyed) {
            return;
        }

        // Mark this connection as handled
        this.handledConnections.add(conn.peer);

        conn.on("open", () => {
            if (this._isDestroyed) return;
            
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
            this.toCallOnNewConnections.forEach(callback => callback());
        });

        conn.on("data", (data) => {
            if (this._isDestroyed) return;
            
            console.log(`Received data from ${conn.peer}:`, data);
            const receivedPacket = data as Packet;
            
            // Check if this is a request/response message
            if ('type' in receivedPacket && (receivedPacket.type === 'request' || receivedPacket.type === 'response')) {
                console.log("Received request/response message, not processing as packet");
                return;
            }
            
            console.log("Processing as packet, calling handlers:", this.dataHandlers.length);
            this.dataHandlers.forEach((handler) => {
                try {
                    handler(receivedPacket);
                } catch (error) {
                    console.error("Error in data handler:", error);
                }
            });
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