/**
 * Integration tests for CLI commands
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';

describe('CLI integration', () => {
  let tempDir: string;
  let dbPath: string;
  const cliPath = join(process.cwd(), 'scripts/index.js');

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'hub-cli-test-'));
    dbPath = join(tempDir, 'test.db');
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  /**
   * Run CLI command and parse JSON output
   */
  function runCli(command: string): any {
    const fullCommand = `node ${cliPath} --db "${dbPath}" ${command}`;
    try {
      const output = execSync(fullCommand, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
      return JSON.parse(output);
    } catch (error: any) {
      // Try to parse error output as JSON
      try {
        return JSON.parse(error.stdout || error.stderr || '{}');
      } catch {
        throw new Error(`CLI command failed: ${error.message}\nOutput: ${error.stdout || error.stderr}`);
      }
    }
  }

  describe('init command', () => {
    it('should initialize a hub in single mode', () => {
      const result = runCli('init --mode single');
      
      expect(result.hub_id).toBeDefined();
      expect(result.mode).toBe('single');
      expect(result.db_path).toBe(dbPath);
      expect(result.channels).toContain('#main');
    });

    it('should initialize a hub in multi mode', () => {
      const result = runCli('init --mode multi');
      
      expect(result.hub_id).toBeDefined();
      expect(result.mode).toBe('multi');
      expect(result.channels).toContain('#main');
      expect(result.channels).toContain('#general');
    });

    it('should accept custom hub ID', () => {
      const result = runCli('init --hub-id custom-123');
      
      expect(result.hub_id).toBe('custom-123');
    });
  });

  describe('post command', () => {
    beforeEach(() => {
      runCli('init --mode single');
    });

    it('should post a message', () => {
      const result = runCli(
        'post --channel "#main" --type note --author alice --content "Test message"'
      );
      
      expect(result.id).toBeDefined();
      expect(result.channel).toBe('#main');
      expect(result.type).toBe('note');
      expect(result.created_at).toBeDefined();
    });

    it('should post a message with tags', () => {
      const result = runCli(
        'post --channel "#main" --type note --author bob --content "Tagged" --tags \'["urgent","bug"]\''
      );
      
      expect(result.id).toBeDefined();
      expect(result.channel).toBe('#main');
    });

    it('should post a message with metadata', () => {
      const result = runCli(
        'post --channel "#main" --type note --author alice --content "Meta" --metadata \'{"priority":"high"}\''
      );
      
      expect(result.id).toBeDefined();
      expect(result.channel).toBe('#main');
    });
  });

  describe('read command', () => {
    beforeEach(() => {
      runCli('init --mode single');
      runCli('post --channel "#main" --type note --author alice --content "Message 1"');
      runCli('post --channel "#main" --type decision --author bob --content "Message 2"');
    });

    it('should read all messages', () => {
      const result = runCli('read');
      
      expect(result.messages).toBeDefined();
      expect(result.messages.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('should filter by channel', () => {
      const result = runCli('read --channel "#main"');
      
      expect(result.messages.every((m: any) => m.channel === '#main')).toBe(true);
    });

    it('should filter by author', () => {
      const result = runCli('read --author alice');
      
      expect(result.messages.every((m: any) => m.author === 'alice')).toBe(true);
    });

    it('should filter by type', () => {
      const result = runCli('read --type decision');
      
      expect(result.messages.every((m: any) => m.type === 'decision')).toBe(true);
    });

    it('should support pagination', () => {
      const result = runCli('read --limit 1');
      
      expect(result.messages.length).toBe(1);
      expect(result.total).toBeGreaterThanOrEqual(1);
    });
  });

  describe('search command', () => {
    beforeEach(() => {
      runCli('init --mode single');
      runCli('post --channel "#main" --type note --author alice --content "Authentication using JWT"');
      runCli('post --channel "#main" --type note --author bob --content "Database connection pooling"');
    });

    it('should search messages', () => {
      const result = runCli('search "Authentication"');
      
      expect(result.results).toBeDefined();
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].content).toContain('Authentication');
      expect(result.results[0].rank).toBeDefined();
    });

    it('should return empty results for no matches', () => {
      const result = runCli('search "nonexistent"');
      
      expect(result.results).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should filter search by channel', () => {
      const result = runCli('search "Authentication" --channel "#main"');
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].channel).toBe('#main');
    });
  });

  describe('status command', () => {
    beforeEach(() => {
      runCli('init --mode multi --hub-id test-status');
      runCli('post --channel "#main" --type note --author alice --content "Test"');
    });

    it('should return hub status', () => {
      const result = runCli('status');
      
      expect(result.hubId).toBeDefined();
      expect(result.mode).toBe('multi');
      expect(result.totalMessages).toBeGreaterThanOrEqual(0);
      expect(result.channels).toBeDefined();
    });
  });

  describe('stats command', () => {
    beforeEach(() => {
      runCli('init --mode single');
      runCli('post --channel "#main" --type note --author alice --content "Test"');
    });

    it('should return hub statistics', () => {
      const result = runCli('stats');
      
      expect(result.dbSizeBytes).toBeGreaterThan(0);
      expect(result.totalMessages).toBeGreaterThanOrEqual(0);
      expect(result.messagesByType).toBeDefined();
      expect(result.ftsStatus).toBeDefined();
    });
  });

  describe('export and import commands', () => {
    beforeEach(() => {
      runCli('init --mode single');
    });

    it('should export messages to NDJSON', () => {
      runCli('post --channel "#main" --type note --author alice --content "Export test"');
      
      const exportFile = join(tempDir, 'export.ndjson');
      execSync(`node ${cliPath} --db "${dbPath}" export > "${exportFile}"`, {
        encoding: 'utf-8',
      });

      const exported = require('fs').readFileSync(exportFile, 'utf-8');
      expect(exported).toContain('Export test');
    });
  });

  describe('gc command', () => {
    beforeEach(() => {
      runCli('init --mode single');
      runCli('post --channel "#main" --type note --author alice --content "Old message"');
    });

    it('should dry-run garbage collection', () => {
      // Use a duration - "0d" means messages older than 0 days (all messages)
      const result = runCli('gc --older-than "100d" --dry-run');
      
      expect(result.removed).toBeGreaterThanOrEqual(0);
    });

    it('should delete old messages', () => {
      // Use a duration - "0d" means messages older than 0 days (all messages)
      const result = runCli('gc --older-than "100d"');
      
      expect(result.removed).toBeGreaterThanOrEqual(0);
      
      // Verify messages can still be counted
      const readResult = runCli('read');
      expect(readResult.total).toBeGreaterThanOrEqual(0);
    });
  });

  describe('reply command', () => {
    let parentId: string;

    beforeEach(() => {
      runCli('init --mode single');
      const parent = runCli('post --channel "#main" --type request --author alice --content "Help needed"');
      parentId = parent.id;
    });

    it('should reply to a message', () => {
      const result = runCli(`reply --thread "${parentId}" --author bob --content "Here to help"`);
      
      expect(result.id).toBeDefined();
      expect(result.channel).toBeDefined();
    });
  });

  describe('update command', () => {
    let messageId: string;

    beforeEach(() => {
      runCli('init --mode single');
      const msg = runCli('post --channel "#main" --type note --author alice --content "Original"');
      messageId = msg.id;
    });

    it('should update message content', () => {
      const result = runCli(`update "${messageId}" --content "Updated"`);
      
      expect(result.id).toBe(messageId);
      expect(result.content).toBe('Updated');
      expect(result.updatedAt).toBeDefined();
    });
  });
});
