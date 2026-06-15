package chat

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"corkbored/backend/internal/auth"
	"corkbored/backend/internal/db"
)

type outMessage struct {
	Type     string           `json:"type"`
	Message  *db.ChatMessage  `json:"message,omitempty"`
	Messages []db.ChatMessage `json:"messages,omitempty"`
	Members  []memberView     `json:"members,omitempty"`
	// Typing indicator fields
	UserID      string `json:"userId,omitempty"`
	DisplayName string `json:"displayName,omitempty"`
}

type memberView struct {
	ID          string  `json:"id"`
	GithubLogin *string `json:"githubLogin"`
	DisplayName *string `json:"displayName"`
	AvatarURL   *string `json:"avatarUrl"`
	Online      bool    `json:"online"`
}

func toMemberViews(members []db.Member) []memberView {
	onlineThreshold := time.Now().Add(-2 * time.Minute)
	views := make([]memberView, len(members))
	for i, m := range members {
		views[i] = memberView{
			ID:          m.User.ID,
			GithubLogin: m.User.GithubLogin,
			DisplayName: m.User.DisplayName,
			AvatarURL:   m.User.AvatarURL,
			Online:      m.PresenceAt != nil && m.PresenceAt.After(onlineThreshold),
		}
	}
	return views
}

// ServeWS handles WebSocket upgrade for /ws/projects/{slug}.
func ServeWS(w http.ResponseWriter, r *http.Request, slug string) {
	token := r.URL.Query().Get("token")
	claims, err := auth.VerifyChatToken(token)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	ctx := r.Context()

	// Resolve slug → project ID and verify the claim matches.
	projectID, err := db.ProjectIDBySlug(ctx, slug)
	if err != nil || projectID != claims.ProjectID {
		http.Error(w, "Not found", http.StatusNotFound)
		return
	}

	// Confirm active membership and fetch display name for typing broadcasts.
	user, err := db.MemberUser(ctx, projectID, claims.UserID)
	if err != nil {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade: %v", err)
		return
	}

	hub := GetOrCreate(projectID)
	client := &Client{
		hub:         hub,
		conn:        conn,
		send:        make(chan []byte, 256),
		UserID:      claims.UserID,
		DisplayName: user.DisplayName,
	}
	hub.register <- client

	// Update presence immediately on connect.
	go func() { _ = db.UpdatePresence(ctx, projectID, claims.UserID) }()

	// Send initial payload: recent messages + member list.
	msgs, _ := db.RecentMessages(ctx, projectID, nil, 60)
	members, _ := db.Members(ctx, projectID)
	initPayload, _ := json.Marshal(outMessage{
		Type:     "init",
		Messages: msgs,
		Members:  toMemberViews(members),
	})
	client.send <- initPayload

	go client.writePump()
	go client.readPump(
		// onMessage: persist + broadcast
		func(body string) {
			msg, err := db.InsertMessage(context.Background(), projectID, claims.UserID, body)
			if err != nil {
				log.Printf("InsertMessage: %v", err)
				return
			}
			hub.Broadcast(outMessage{Type: "message", Message: msg})
		},
		// onTyping: broadcast to others (no DB write)
		func() {
			hub.BroadcastExcept(client, outMessage{
				Type:        "typing",
				UserID:      claims.UserID,
				DisplayName: client.DisplayName,
			})
		},
	)
}
