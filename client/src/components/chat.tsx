import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { type ChatMessage } from "@shared/schema";

interface ChatProps {
  streamId: string;
}

export function Chat({ streamId }: ChatProps) {
  const [message, setMessage] = useState("");
  const [username, setUsername] = useState(
    localStorage.getItem("username") || `Usuario${Math.floor(Math.random() * 1000)}`
  );
  const [lastAdminMessage, setLastAdminMessage] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat", streamId],
    refetchInterval: 2500,
    staleTime: 2000,
  });

  const sendMessageMutation = useMutation({
    mutationFn: async (messageData: {
      streamId: string;
      username: string;
      message: string;
      role?: "admin" | "user";
    }) => {
      const response = await apiRequest("POST", "/api/chat", messageData);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/chat", streamId] });
      setMessage("");
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = message.trim();
    if (!text) return;

    const role: "admin" | "user" = username.toLowerCase() === "reydecopas" ? "admin" : "user";

    sendMessageMutation.mutate({
      streamId,
      username,
      message: text,
      role,
    });
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    const lastAdmin = [...messages].reverse().find((m) => m.role === "admin");
    if (lastAdmin) {
      setLastAdminMessage(lastAdmin.message);
      const timer = setTimeout(() => setLastAdminMessage(null), 10000);
      return () => clearTimeout(timer);
    }
  }, [messages]);

  return (
    <div className="relative w-full">
      {/* 📌 Cartel flotante admin */}
      {lastAdminMessage && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white px-4 py-2 rounded-xl shadow-lg">
          {lastAdminMessage}
        </div>
      )}

      <Card className="flex flex-col h-[50vh] sm:h-[55vh] md:h-[60vh] lg:h-[65vh]">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <MessageCircle className="w-4 h-4" />
            Chat en Vivo
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 flex flex-col min-h-0 gap-3 p-3">
          {/* 📝 Lista de mensajes */}
          <ScrollArea className="flex-1 min-h-0 pr-3" ref={scrollAreaRef}>
            <div className="space-y-2">
              {isLoading ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  Cargando mensajes...
                </div>
              ) : messages.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-4">
                  No hay mensajes aún. ¡Sé el primero en comentar!
                </div>
              ) : (
                messages.map((m, idx) => (
                  <div
                    key={m.id ?? idx}
                    className={`text-sm ${m.role === "admin" ? "text-red-600 font-bold" : ""}`}
                  >
                    {m.role === "admin" ? (
                      <span className="font-bold">🌐 BarrileteCosmicoTv</span>
                    ) : (
                      <span className="font-semibold">@{m.username}</span>
                    )}
                    <span className="text-muted-foreground">: </span>
                    <span>{m.message}</span>
                    {m.createdAt && (
                      <span className="ml-2 text-[11px] text-muted-foreground">
                        {new Date(m.createdAt).toLocaleTimeString()}
                      </span>
                    )}
                    <Separator className="my-2 opacity-25" />
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {}
          <form onSubmit={handleSendMessage} className="flex items-center gap-2">
            <Input
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
            />
            <Button type="submit" className="shrink-0" disabled={sendMessageMutation.isPending}>
              <Send className="w-4 h-4" />
            </Button>
          </form>

          {}
          <div className="flex items-center gap-2 mt-2">
            <Input
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                localStorage.setItem("username", e.target.value);
              }}
              placeholder="Tu @usuario"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}