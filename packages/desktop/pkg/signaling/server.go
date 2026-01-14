package signaling

import (
	"net/http"

	"github.com/claudeflare/desktop/pkg/webrtc"
	"github.com/gin-gonic/gin"
)

// Server handles WebRTC signaling
type Server struct {
	webrtcManager *webrtc.Manager
}

// NewServer creates a new signaling server
func NewServer(manager *webrtc.Manager) *Server {
	return &Server{
		webrtcManager: manager,
	}
}

// HandleOffer handles WebRTC offer from remote peer
func (s *Server) HandleOffer(c *gin.Context) {
	var offer struct {
		PeerID    string `json:"peerId"`
		SessionID string `json:"sessionId"`
		SDP       string `json:"sdp"`
	}

	if err := c.ShouldBindJSON(&offer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Create peer connection
	peer, err := s.webrtcManager.CreatePeer(offer.PeerID, offer.SessionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, we would:
	// 1. Create actual WebRTC PeerConnection
	// 2. Set remote description with offer
	// 3. Create answer
	// 4. Return answer to client
	
	c.JSON(http.StatusOK, gin.H{
		"peerId": peer.ID,
		"state":  peer.State,
	})
}

// HandleAnswer handles WebRTC answer from remote peer
func (s *Server) HandleAnswer(c *gin.Context) {
	var answer struct {
		PeerID string `json:"peerId"`
		SDP    string `json:"sdp"`
	}

	if err := c.ShouldBindJSON(&answer); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, set remote description with answer
	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}

// HandleICECandidate handles ICE candidate from remote peer
func (s *Server) HandleICECandidate(c *gin.Context) {
	var candidate struct {
		PeerID    string `json:"peerId"`
		Candidate string `json:"candidate"`
	}

	if err := c.ShouldBindJSON(&candidate); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// In a real implementation, add ICE candidate to peer connection
	c.JSON(http.StatusOK, gin.H{"status": "accepted"})
}
