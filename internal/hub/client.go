package hub

import (
	"log"
	"time"

	"github.com/gorilla/websocket"
)

const (
	// Time allowed to write a message to the client
	writeWait = 10 * time.Second

	// Time allowed to read the next message from the client
	pongWait = 60 * time.Second

	// Send pings to client with this period — must be less than pongWait
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from client
	maxMessageSize = 512 * 1024 // 512KB
)

// ReadPump reads messages from the WebSocket connection and broadcasts them.
// This runs in its own goroutine per client.
// When this goroutine exits, the client is unregistered from the Hub.
func (c *Client) ReadPump(h *Hub) {
	defer func() {
		h.Unregister(c)
		c.Conn.Close()
	}()

	c.Conn.SetReadLimit(maxMessageSize)
	c.Conn.SetReadDeadline(time.Now().Add(pongWait))
	c.Conn.SetPongHandler(func(string) error {
		c.Conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, raw, err := c.Conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err,
				websocket.CloseGoingAway,
				websocket.CloseAbnormalClosure,
			) {
				log.Printf("websocket error: %v", err)
			}
			break
		}

		// Every valid message must have at least a type byte
		if len(raw) < 2 {
			continue
		}

		msg := Message{
			Type:    raw[0],
			Payload: raw[1:],
			Sender:  c,
		}

		h.Route(msg)
	}
}

// WritePump reads from the client's send channel and writes to the WebSocket.
// This runs in its own goroutine per client.
// One goroutine per client ensures only one concurrent writer per connection.
func (c *Client) WritePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.Conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				// Hub closed the channel — client was unregistered
				c.Conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.Conn.WriteMessage(websocket.BinaryMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			// Send a ping to keep the connection alive
			c.Conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.Conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
