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
            alert('Bağlantı Hatası: ' + err.type);
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
        if (!remoteId) return alert("Lütfen bir oda kodu girin!");

        State.networkRole = 'client';
        State.isOnline = true;
        State.remotePeerId = remoteId;

        document.getElementById('onlineStatus').innerText = "Bağlanıyor...";

        this.conn = this.peer.connect(remoteId);
        State.conn = this.conn;
        this.setupConnection();
    },

    setupConnection() {
        this.conn.on('open', () => {
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
            } else if (data.type === 'chat_msg') {
                // Anyone can receive chat
                window.dispatchEvent(new CustomEvent('networkChat', { detail: data }));
            }
        });

        this.conn.on('close', () => {
            alert("Bağlantı koptu!");
            location.reload();
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

    sendChat(text, playerName, team) {
        if (this.conn && this.conn.open) {
            this.conn.send({ type: 'chat_msg', text, playerName, team });
        }
    }
};
