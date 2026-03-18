/**
 * Forge Playwright Skill — Type definitions
 */

import { z } from "zod";

// ─── Project Config (.playwright-mcp/config.json) ───

export const PortsSchema = z.object({
  frontend: z.number().default(3000),
  api: z.number().default(5000),
  auth: z.number().optional(),
});

export const ProjectConfigSchema = z.object({
  ports: PortsSchema.default({}),
  frontendFramework: z.enum(["react-vite", "next", "flutter-web", "angular", "vue", "astro", "other"]).default("react-vite"),
  authPattern: z.enum(["api-mock", "cookie", "token", "oidc", "none"]).default("api-mock"),
  authEndpoint: z.string().default("/api/me"),
  defaultProfile: z.string().default("admin"),
  baseUrl: z.string().optional(),
  notes: z.string().optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ─── Mock Profile (.playwright-mcp/profiles/*.json) ───

export const RouteSchema = z.object({
  pattern: z.string(),
  status: z.number().default(200),
  contentType: z.string().default("application/json"),
  body: z.union([z.string(), z.record(z.unknown()), z.array(z.unknown())]),
  description: z.string().optional(),
});

export const CookieSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().default("localhost"),
  path: z.string().default("/"),
  httpOnly: z.boolean().optional(),
  secure: z.boolean().optional(),
  sameSite: z.enum(["Strict", "Lax", "None"]).optional(),
});

export const LocalStorageEntrySchema = z.object({
  key: z.string(),
  value: z.string(),
});

export const ProfileSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  routes: z.array(RouteSchema).default([]),
  cookies: z.array(CookieSchema).optional(),
  localStorage: z.record(z.string()).optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type Route = z.infer<typeof RouteSchema>;

// ─── Init Page (.playwright-mcp/init-pages/*.ts) ───

export interface InitPageInfo {
  name: string;
  path: string;
  content: string;
}

// ─── CLI ───

export interface ExecRequest {
  code: string;
  timeout?: number;
}

export interface ExecResponse {
  success: boolean;
  result?: unknown;
  error?: string;
  execution_time_ms: number;
}

// ─── MCP Config ───

export interface MCPConfigRecommendation {
  args: string[];
  reasons: string[];
  warnings: string[];
}
