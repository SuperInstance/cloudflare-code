package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/claudeflare/desktop/pkg/webrtc"
	"github.com/claudeflare/desktop/pkg/signaling"
	"github.com/gin-gonic/gin"
)

func main() {
	// Get port from environment or use default
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	// Initialize router
	router := gin.Default()

	// Initialize WebRTC manager
	webrtcManager := webrtc.NewManager()
	
	// Initialize signaling server
	signalingServer := signaling.NewServer(webrtcManager)

	// Setup routes
	api := router.Group("/api")
	{
		api.GET("/health", healthCheck)
		api.GET("/info", getInfo)
		api.POST("/webrtc/offer", signalingServer.HandleOffer)
		api.POST("/webrtc/answer", signalingServer.HandleAnswer)
		api.POST("/webrtc/ice", signalingServer.HandleICECandidate)
	}

	// Start server
	addr := fmt.Sprintf(":%s", port)
	log.Printf("ClaudeFlare Desktop starting on %s", addr)
	
	if err := router.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func healthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "healthy",
		"service": "claudeflare-desktop",
	})
}

func getInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"name": "ClaudeFlare Desktop",
		"version": "0.1.0",
		"description": "Local WebRTC proxy for agent mesh communication",
		"features": []string{
			"webrtc-signaling",
			"datachannel-rpc",
			"agent-discovery",
			"local-privacy",
		},
	})
}
