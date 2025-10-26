import { sql } from "drizzle-orm";
import { pgTable, text, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";


export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});


export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export const InsertChatMessageSchema = z.object({
  streamId: z.string().min(1),
  username: z.string().min(1),
  message: z.string().min(1),        
  role: z.enum(["user", "admin"]).optional(),
  
});

export type InsertChatMessage = z.infer<typeof InsertChatMessageSchema>;

export const ChatMessageSchema = InsertChatMessageSchema.extend({
  id: z.string().min(1),
  createdAt: z.string().min(1),
  role: z.enum(["user", "admin"]).default("user"),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;


export const InsertStreamSchema = z.object({
  
  id: z.string().optional(),
  title: z.string().min(1),
  sourceUrl: z.string().min(1), 
  quality: z.string().min(1),  
  audioQuality: z.string().optional(),
  status: z.enum(["live", "offline", "starting"]).optional(),
  metadata: z
    .object({
      channel: z.string().optional(),
      language: z.string().optional(),
      region: z.string().optional(),
    })
    .optional(),
});

export type InsertStream = z.infer<typeof InsertStreamSchema>;

export const StreamSchema = InsertStreamSchema.extend({
  id: z.string().min(1),
  processedUrl: z.string().nullable().optional(),
});

export type Stream = z.infer<typeof StreamSchema>;