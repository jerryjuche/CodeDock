"use client";

import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQueryClient } from "@tanstack/react-query";

const MESSAGE_TYPE_ROOM_UPDATE = 0x0a;

export function useRoomSync(roomId: string) {
  const { token, hydrated } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!hydrated || !token || !roomId) return;

    let socket: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout;

    function connect() {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = process.env.NEXT_PUBLIC_API_URL 
        ? process.env.NEXT_PUBLIC_API_URL.replace(/^https?:\/\//, "") 
        : "localhost:8080";
        
      const url = `${protocol}//${host}/ws?room_id=${roomId}&token=${token}&client=web`;
      
      socket = new WebSocket(url);
      socket.binaryType = "arraybuffer";

      socket.onopen = () => {
        // Recover from any cached errors the moment the socket connects
        queryClient.invalidateQueries({ queryKey: ["room-details", roomId] });
        queryClient.invalidateQueries({ queryKey: ["room-presence", roomId] });
        queryClient.invalidateQueries({ queryKey: ["room-activities", roomId] });
      };

      socket.onmessage = (event) => {
        if (!(event.data instanceof ArrayBuffer)) return;
        
        const data = new Uint8Array(event.data);
        const type = data[0];

        if (type === MESSAGE_TYPE_ROOM_UPDATE) {
          // Trigger instant re-fetch of room details
          queryClient.invalidateQueries({ queryKey: ["room-details", roomId] });
          queryClient.invalidateQueries({ queryKey: ["room-presence", roomId] });
          queryClient.invalidateQueries({ queryKey: ["room-activities", roomId] });
        }
      };

      socket.onclose = () => {
        reconnectTimeout = setTimeout(connect, 3000);
      };

      socket.onerror = () => {
        // Suppress console.error to prevent Next.js dev overlays when the room is simply deactivated.
        // The onclose handler will automatically retry the connection.
      };
    }

    connect();

    return () => {
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
      clearTimeout(reconnectTimeout);
    };
  }, [roomId, token, hydrated, queryClient]);
}
