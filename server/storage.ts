import {
  type User,
  type InsertUser,
  type Stream,
  type InsertStream,
  type ChatMessage,
  type InsertChatMessage,
} from "@shared/schema";
import { randomUUID } from "crypto";

const SECURE_SOURCES = new Map<string, string>([
  // EXISTENTES
  ["internal://protected-source-001", "http://xxx.xx.xxx.xxx:8500/play/a09v"], // ESPN Premium HD
  ["internal://protected-source-003", "http://xxx.xx.xxx.xxx:8500/play/a08j"], // TNT Sports HD

  // NUEVOS
  ["internal://protected-source-101", "http://xxx.xx.xxx.xxx:8888/play/a0co/index.m3u8"], // DirecTV SPORT
  ["internal://protected-source-102", "http://xxx.xx.xxx.xxx:8888/play/a0jb/index.m3u8"], // DirecTV+
  ["internal://protected-source-103", "http://xxx.xx.xxx.xxx:8500/play/a013"],            // ESPN HD (81w) AR
  ["internal://protected-source-104", "http://xxx.xx.xxx.xxx:8500/play/a012"],            // ESPN 2 HD (81w) AR
  ["internal://protected-source-105", "http://xxx.xx.xxx.xxx:8500/play/a03x"],            // Fox Sports HD (81w) AR
  ["internal://protected-source-106", "http://xxx.xx.xxx.xxx:8500/play/a014"],            // ESPN 3 HD (81w) AR
]);

export function getSecureSourceUrl(sourceIdOrUrl: string): string {
  return SECURE_SOURCES.get(sourceIdOrUrl) || sourceIdOrUrl;
}

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getStream(id: string): Promise<Stream | undefined>;
  getAllStreams(): Promise<Stream[]>;
  createStream(stream: InsertStream): Promise<Stream>;
  updateStream(id: string, updates: Partial<Stream>): Promise<Stream | undefined>;
  deleteStream(id: string): Promise<boolean>;

  getChatMessages(streamId: string): Promise<ChatMessage[]>;
  createChatMessage(message: InsertChatMessage): Promise<ChatMessage>;
}

export class MemStorage implements IStorage {
  private users = new Map<string, User>();
  private streams = new Map<string, Stream>();
  private chatMessages = new Map<string, ChatMessage[]>();

  constructor() {
    this.initializeDefaultStreams();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  private initializeDefaultStreams() {
    const ESPN_PREMIUM_SOURCE =
      process.env.ESPN_PREMIUM_STREAM_URL || "internal://protected-source-001";
    const TNT_SOURCE =
      process.env.TNT_STREAM_URL || "internal://protected-source-003";

    const DIRECTV_SPORT_SOURCE =
      process.env.DIRECTV_SPORT_STREAM_URL || "internal://protected-source-101";
    const DIRECTV_PLUS_SOURCE =
      process.env.DIRECTV_PLUS_STREAM_URL || "internal://protected-source-102";
    const ESPN_HD_SOURCE =
      process.env.ESPN_HD_STREAM_URL || "internal://protected-source-103";
    const ESPN2_HD_SOURCE =
      process.env.ESPN2_HD_STREAM_URL || "internal://protected-source-104";
    const FOX_SPORTS_HD_SOURCE =
      process.env.FOX_SPORTS_HD_STREAM_URL || "internal://protected-source-105";
    const ESPN3_HD_SOURCE =
      process.env.ESPN3_HD_STREAM_URL || "internal://protected-source-106";

    const defaults: Stream[] = [
      {
        id: "espn-premium-hd",
        title: "ESPN Premium HD AR",
        sourceUrl: ESPN_PREMIUM_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "ESPN Premium", region: "Argentina", language: "Spanish" },
      },
      {
        id: "tnt-sports-hd",
        title: "TNT Sports HD AR",
        sourceUrl: TNT_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "TNT Sports", region: "Argentina", language: "Spanish" },
      },
      // Nuevos
      {
        id: "directv-sport",
        title: "DirecTV SPORT",
        sourceUrl: DIRECTV_SPORT_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "DirecTV SPORT", region: "LatAm", language: "Spanish" },
      },
      {
        id: "directv-plus",
        title: "DirecTV+",
        sourceUrl: DIRECTV_PLUS_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "DirecTV+", region: "LatAm", language: "Spanish" },
      },
      {
        id: "espn-hd",
        title: "ESPN HD (81w) AR",
        sourceUrl: ESPN_HD_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "ESPN", region: "Argentina", language: "Spanish" },
      },
      {
        id: "espn2-hd",
        title: "ESPN 2 HD (81w) AR",
        sourceUrl: ESPN2_HD_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "ESPN 2", region: "Argentina", language: "Spanish" },
      },
      {
        id: "espn3-hd",
        title: "ESPN 3 HD (81w) AR",
        sourceUrl: ESPN3_HD_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "ESPN 3", region: "Argentina", language: "Spanish" },
      },
      {
        id: "fox-sports-hd",
        title: "Fox Sports HD (81w) AR",
        sourceUrl: FOX_SPORTS_HD_SOURCE,
        processedUrl: null,
        quality: "1080p",
        audioQuality: "high",
        status: "live",
        metadata: { channel: "Fox Sports", region: "Argentina", language: "Spanish" },
      },
    ];

    for (const s of defaults) {
      this.streams.set(s.id, s);
      if (!this.chatMessages.has(s.id)) this.chatMessages.set(s.id, []);
    }
  }

  async getStream(id: string): Promise<Stream | undefined> {
    return this.streams.get(id);
  }

  async getAllStreams(): Promise<Stream[]> {
    const visible = new Set(["espn-premium-hd", "tnt-sports-hd"]);
    return Array.from(this.streams.values()).filter(s => visible.has(s.id));
  }

  async createStream(insertStream: InsertStream): Promise<Stream> {
    const id = insertStream.id ?? randomUUID();
    const stream: Stream = {
      id,
      title: insertStream.title,
      sourceUrl: insertStream.sourceUrl,
      processedUrl: null,
      quality: insertStream.quality,
      audioQuality: insertStream.audioQuality,
      status: insertStream.status ?? "offline",
      metadata: insertStream.metadata,
    };
    this.streams.set(id, stream);
    if (!this.chatMessages.has(id)) this.chatMessages.set(id, []);
    return stream;
  }

  async updateStream(
    id: string,
    updates: Partial<Stream>
  ): Promise<Stream | undefined> {
    const current = this.streams.get(id);
    if (!current) return undefined;
    const next: Stream = { ...current, ...updates };
    this.streams.set(id, next);
    return next;
  }

  async deleteStream(id: string): Promise<boolean> {
    const ok = this.streams.delete(id);
    if (ok) this.chatMessages.delete(id);
    return ok;
  }

  async getChatMessages(streamId: string): Promise<ChatMessage[]> {
    return this.chatMessages.get(streamId) || [];
  }

  async createChatMessage(insertMessage: InsertChatMessage): Promise<ChatMessage> {
    const id = randomUUID();
    const message: ChatMessage = {
      ...insertMessage,
      id,
      role: insertMessage.role || "user",
      createdAt: new Date().toISOString(),
    };
    const list = this.chatMessages.get(insertMessage.streamId) || [];
    list.push(message);
    this.chatMessages.set(insertMessage.streamId, list);
    return message;
  }
}

export const storage = new MemStorage();

const likesStore = new Map<string, number>();

export function getLikeCount(streamId: string): number {
  return likesStore.get(streamId) ?? 0;
}

export function applyLike(streamId: string): number {
  const next = (likesStore.get(streamId) ?? 0) + 1;
  likesStore.set(streamId, next);
  return next;
}

export function applyUnlike(streamId: string): number {
  const next = Math.max(0, (likesStore.get(streamId) ?? 0) - 1);
  likesStore.set(streamId, next);
  return next;
}