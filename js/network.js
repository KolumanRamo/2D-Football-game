import { State, Config } from './config.js';

export const NetworkManager = {
    peer: null,
    conn: null,

    init() {
        if (this.peer) return;

        this.peer = new Peer();

        this.peer.on('open', (id) => {
            console.log('My peer ID is: ' + id);
            State.peerId = id;
            const statusEl = document.getElementById('onlineStatus');
            if (statusEl) statusEl.innerText = "Bağlantı Hazır";
            const myPeerIdEl = document.getElementById('myPeerId');
            if (myPeerIdEl) myPeerIdEl.innerText = id;
        });

        this.peer.on('connection', (connection) => {
            if (State.networkRole === 'host' && !this.conn) {
                this.conn = connection;
                State.conn = connection;
                this.setupConnection();
                console.log('Guest connected!');
            }
        });

        this.peer.on('error', (err) => {
            console.error('PeerJS Error:', err);
            alert('Bağlantı Hatası (Sunucu Kapanmış Olabilir): ' + err.type);

            // Reset UI and State back to main screen to prevent getting stuck
            State.isOnline = false;
            State.networkRole = null;
            if (this.conn) {
                this.conn.close();
                this.conn = null;
                State.conn = null;
            }
            const onlineMenu = document.getElementById('onlineMenu');
            if (onlineMenu) onlineMenu.classList.add('hidden');
            const lobbyMenu = document.getElementById('lobbyMenu');
            if (lobbyMenu) lobbyMenu.classList.add('hidden');
            const startScreen = document.getElementById('startScreen');
            if (startScreen) startScreen.classList.remove('hidden');
            const globalLoadingOverlay = document.getElementById('globalLoadingOverlay');
            if (globalLoadingOverlay) globalLoadingOverlay.classList.add('hidden');
        });
    },

    host() {
        State.networkRole = 'host';
        State.isOnline = true;
        // Instead of waiting, Host opens the lobby immediately so they can see their Room Menu
        document.getElementById('onlineMenu').classList.add('hidden');
        window.dispatchEvent(new CustomEvent('networkReady'));
    },

    join(remoteId) {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
        }

        if (!remoteId) {
            alert("Lobi bulunamadı veya lobi sahibi odadan çıkmış. (Geçersiz Oda)");
            const onlineMenu = document.getElementById('onlineMenu');
            if (onlineMenu) onlineMenu.classList.add('hidden');
            const lobbiesScreen = document.getElementById('lobbiesScreen');
            if (lobbiesScreen) lobbiesScreen.classList.remove('hidden');
            const startScreen = document.getElementById('startScreen');
            if (startScreen && lobbiesScreen && lobbiesScreen.classList.contains('hidden')) startScreen.classList.remove('hidden');
            return;
        }

        State.networkRole = 'client';
        State.isOnline = true;
        State.remotePeerId = remoteId;

        document.getElementById('onlineStatus').innerText = "Bağlanıyor...";

        this.conn = this.peer.connect(remoteId);
        State.conn = this.conn;
        this.setupConnection();

        // Add 10-second timeout for joining
        this.connectionTimeout = setTimeout(() => {
            if (this.conn && !this.conn.open) {
                console.error("Connection timeout!");
                this.conn.close();
                this.conn = null;
                State.conn = null;
                State.isOnline = false;
                State.networkRole = null;

                const globalLoadingOverlay = document.getElementById('globalLoadingOverlay');
                if (globalLoadingOverlay) globalLoadingOverlay.classList.add('hidden');

                alert("Bağlantı zaman aşımına uğradı. Oda kapanmış olabilir.");

                const lobbiesScreen = document.getElementById('lobbiesScreen');
                if (lobbiesScreen) lobbiesScreen.classList.remove('hidden');
                const startScreen = document.getElementById('startScreen');
                if (startScreen && lobbiesScreen && lobbiesScreen.classList.contains('hidden')) startScreen.classList.remove('hidden');
            }
        }, 10000);
    },

    setupConnection() {
        this.conn.on('open', () => {
            if (this.connectionTimeout) {
                clearTimeout(this.connectionTimeout);
                this.connectionTimeout = null;
            }
            console.log('Connection established!');
            if (State.networkRole === 'client') {
                document.getElementById('onlineMenu').classList.add('hidden');
                // Notify main to show lobby for client
                window.dispatchEvent(new CustomEvent('networkReady'));
            }
        });

        this.conn.on('data', (data) => {
            if (data.type === 'input') {
                State.remoteInput = data.input;
            } else if (data.type === 'state') {
                // Client receives state from Host
                this.applyState(data.state);
            } else if (data.type === 'goal') {
                // Client receives goal event
                window.dispatchEvent(new CustomEvent('networkGoal', { detail: data.team }));
            } else if (data.type === 'lobby_state') {
                State.lobby = data.state;
                window.dispatchEvent(new CustomEvent('lobbyStateUpdated'));
            } else if (data.type === 'lobby_action') {
                window.dispatchEvent(new CustomEvent('lobbyActionReceived', { detail: data }));
            } else if (data.type === 'start_game') {
                window.dispatchEvent(new CustomEvent('networkStartGame'));
            } else if (data.type === 'return_to_lobby') {
                window.dispatchEvent(new CustomEvent('networkReturnToLobby'));
            } else if (data.type === 'chat_msg') {
                // Anyone can receive chat
                window.dispatchEvent(new CustomEvent('networkChat', { detail: data }));
            }
        });

        this.conn.on('close', () => {
            const globalLoadingOverlay = document.getElementById('globalLoadingOverlay');
            if (globalLoadingOverlay) globalLoadingOverlay.classList.add('hidden');

            if (State.networkRole === 'client') {
                alert("Bağlantı koptu! Lobi kurucusu çıkmış olabilir.");
                location.reload();
            } else if (State.networkRole === 'host') {
                // Host handles client disconnect
                console.log("Guest disconnected.");
                this.conn = null;
                State.conn = null;
                // If we are in the lobby menu, remove the guest
                if (State.lobby && State.lobby.players) {
                    const guestId = Object.keys(State.lobby.players).find(id => id !== State.peerId);
                    if (guestId) {
                        delete State.lobby.players[guestId];
                        this.sendLobbyState(State.lobby);
                        // Trigger UI update
                        window.dispatchEvent(new CustomEvent('lobbyStateUpdated'));
                    }
                }
            }
        });
    },

    sendInput(input) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'input', input });
        }
    },

    sendState(gameState) {
        if (this.conn && this.conn.open && State.networkRole === 'host') {
            this.conn.send({ type: 'state', state: gameState });
        }
    },

    applyState(remoteState) {
        // Only clients apply remote state
        if (State.networkRole !== 'client') return;

        window.dispatchEvent(new CustomEvent('applyRemoteState', { detail: remoteState }));
    },

    sendLobbyState(lobbyState) {
        if (this.conn && this.conn.open && State.networkRole === 'host') {
            this.conn.send({ type: 'lobby_state', state: lobbyState });
        }
    },

    sendLobbyAction(actionData) {
        if (this.conn && this.conn.open && State.networkRole === 'client') {
            this.conn.send({ type: 'lobby_action', ...actionData });
        }
    },

    sendStartGame() {
        if (this.conn && this.conn.open && State.networkRole === 'host') {
            this.conn.send({ type: 'start_game' });
        }
    },

    sendReturnToLobby() {
        if (this.conn && this.conn.open && State.networkRole === 'host') {
            this.conn.send({ type: 'return_to_lobby' });
        }
    },

    sendChat(text, playerName, team) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'chat_msg', text, playerName, team });
        }
    }
};
