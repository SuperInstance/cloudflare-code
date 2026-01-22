package webrtc

import (
	"sync"
)

// Manager handles WebRTC peer connections
type Manager struct {
	mu       sync.RWMutex
	peers    map[string]*PeerConnection
}

// PeerConnection represents a WebRTC peer connection
type PeerConnection struct {
	ID           string
	RemoteID     string
	DataChannels map[string]*DataChannel
	State        string
}

// DataChannel represents a WebRTC data channel
type DataChannel struct {
	Label       string
	State       string
	BufferedAmount uint64
}

// NewManager creates a new WebRTC manager
func NewManager() *Manager {
	return &Manager{
		peers: make(map[string]*PeerConnection),
	}
}

// CreatePeer creates a new peer connection
func (m *Manager) CreatePeer(id, remoteID string) (*PeerConnection, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	peer := &PeerConnection{
		ID:           id,
		RemoteID:     remoteID,
		DataChannels: make(map[string]*DataChannel),
		State:        "new",
	}

	m.peers[id] = peer
	return peer, nil
}

// GetPeer retrieves a peer connection by ID
func (m *Manager) GetPeer(id string) (*PeerConnection, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	peer, ok := m.peers[id]
	return peer, ok
}

// RemovePeer removes a peer connection
func (m *Manager) RemovePeer(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	delete(m.peers, id)
}
