# Low-Level Hub Access

The `hub` object is also in scope for operations not covered by SDK:

| Method | Description |
|--------|-------------|
| `hub.post(opts)` | Raw post: `{ channel, type, author, content, tags?, metadata? }` |
| `hub.reply(threadId, opts)` | Raw reply: `{ author, content, tags?, metadata? }` |
| `hub.read(opts?)` | Read with filters: `{ channel?, type?, author?, tags?, since?, limit? }` |
| `hub.search(query, opts?)` | FTS5 search |
| `hub.readThread(messageId)` | Full thread |
| `hub.update(id, opts)` | Update message |
| `hub.channelCreate(name, opts?)` | Create channel |
| `hub.channelList(includeStats?)` | List channels |
