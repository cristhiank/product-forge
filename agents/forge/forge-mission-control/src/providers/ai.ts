import { CopilotClient, approveAll } from '@github/copilot-sdk';

export interface AIStreamEvent {
  type: 'delta' | 'done' | 'error';
  content?: string;
  error?: string;
}

export class AIProvider {
  private client: CopilotClient | null = null;

  async initialize(): Promise<boolean> {
    try {
      this.client = new CopilotClient();
      return true;
    } catch {
      return false;
    }
  }

  async *streamCompletion(prompt: string): AsyncGenerator<AIStreamEvent> {
    if (!this.client) {
      yield { type: 'error', error: 'AI not initialized' };
      return;
    }

    const chunks: string[] = [];
    let done = false;
    let error: string | null = null;

    const session = await this.client.createSession({
      model: 'claude-sonnet-4.6',
      streaming: true,
      onPermissionRequest: approveAll,
    });

    session.on('assistant.message_delta', (event) => {
      if (event.data.deltaContent) chunks.push(event.data.deltaContent);
    });
    session.on('session.idle', () => { done = true; });
    session.on('session.error', (event) => { error = String(event.data?.message ?? event); done = true; });

    // Send and don't await here — events fire as it streams
    const sendPromise = session.sendAndWait({ prompt }).catch(() => {});

    while (!done) {
      await new Promise<void>(r => setTimeout(r, 30));
      while (chunks.length > 0) {
        yield { type: 'delta', content: chunks.shift()! };
      }
    }

    // Drain remaining chunks
    while (chunks.length > 0) {
      yield { type: 'delta', content: chunks.shift()! };
    }

    await sendPromise;

    if (error) {
      yield { type: 'error', error };
    } else {
      yield { type: 'done' };
    }
  }

  async stop(): Promise<void> {
    if (this.client) {
      await this.client.stop();
      this.client = null;
    }
  }
}
