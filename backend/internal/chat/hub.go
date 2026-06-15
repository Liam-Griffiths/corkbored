package chat

import (
	"encoding/json"
	"sync"
)

// Hub maintains all active WebSocket clients for a single project.
type Hub struct {
	projectID string
	clients   map[*Client]bool
	broadcast chan []byte
	register  chan *Client
	unregister chan *Client
	mu        sync.RWMutex
}

func newHub(projectID string) *Hub {
	return &Hub{
		projectID:  projectID,
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case c := <-h.register:
			h.mu.Lock()
			h.clients[c] = true
			h.mu.Unlock()

		case c := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[c]; ok {
				delete(h.clients, c)
				close(c.send)
			}
			h.mu.Unlock()

		case msg := <-h.broadcast:
			h.mu.RLock()
			for c := range h.clients {
				select {
				case c.send <- msg:
				default:
					// Slow client — drop and close
					close(c.send)
					delete(h.clients, c)
				}
			}
			h.mu.RUnlock()
		}
	}
}

func (h *Hub) Broadcast(v any) {
	b, err := json.Marshal(v)
	if err != nil {
		return
	}
	h.broadcast <- b
}

func (h *Hub) ConnectionCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}

// Registry maps project IDs to their active hub.
var (
	registryMu sync.Mutex
	registry   = make(map[string]*Hub)
)

// GetOrCreate returns the hub for a project, creating and running one if needed.
func GetOrCreate(projectID string) *Hub {
	registryMu.Lock()
	defer registryMu.Unlock()
	h, ok := registry[projectID]
	if !ok {
		h = newHub(projectID)
		registry[projectID] = h
		go h.run()
	}
	return h
}
