// extension/src/chat.ts

import * as vscode from 'vscode'
import { WebSocketManager } from './websocket'
import { encodeChatPayload, decodeChatPayload, MessageType } from './protocol'
import { ChatMessage } from './types'

export class ChatManager {
    // single panel instance — revealed if exists, created if not
    private panel: vscode.WebviewPanel | null = null
    private messages: ChatMessage[] = []
    private localUserId: string = ''
    private localEmail: string = ''

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly wsManager: WebSocketManager
    ) {
        this.wsManager.onMessage((data) => this.handleIncoming(data))
    }

    // --- Public API ---

    activate(userId: string, email: string): void {
        this.localUserId = userId
        this.localEmail = email
    }

    open(): void {
        // reveal existing panel instead of creating a new one
        if (this.panel) {
            this.panel.reveal(vscode.ViewColumn.Beside)
            return
        }

        // create panel — sandboxed webview
        this.panel = vscode.window.createWebviewPanel(
            'codedockChat',
            'CodeDock Chat',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        )

        // render initial HTML
        this.panel.webview.html = this.buildHtml()

        // handle messages from the webview — user sending chat
        this.panel.webview.onDidReceiveMessage((message) => {
            if (message.type === 'send' && typeof message.content === 'string') {
                this.sendMessage(message.content.trim())
            }
        })

        // clean up when panel is closed by user
        this.panel.onDidDispose(() => {
            this.panel = null
        })
    }

    dispose(): void {
        this.panel?.dispose()
        this.panel = null
    }

    // --- Outbound ---

    private sendMessage(content: string): void {
        if (!content) {
            return
        }

        const message: ChatMessage = {
            id: crypto.randomUUID(),
            userId: this.localUserId,
            email: this.localEmail,
            content,
            timestamp: Date.now()
        }

        const payload = encodeChatPayload(message)
        this.wsManager.send(payload)

        // render own message immediately — optimistic update
        this.appendMessage(message)
    }

    // --- Inbound ---

    private handleIncoming(data: Uint8Array): void {
        if (data[0] !== MessageType.CHAT) {
            return
        }

        const message = decodeChatPayload<ChatMessage>(data)
        if (!message || !message.userId || !message.content) {
            return
        }

        // skip own messages — already rendered optimistically
        if (message.userId === this.localUserId) {
            return
        }

        this.appendMessage(message)
    }

    private appendMessage(message: ChatMessage): void {
        this.messages.push(message)

        if (!this.panel) {
            return
        }

        // send to webview — sanitized before rendering
        this.panel.webview.postMessage({
            type: 'append',
            message: {
                email: this.sanitize(message.email),
                content: this.sanitize(message.content),
                timestamp: message.timestamp
            }
        })
    }

    // --- Security ---

    private sanitize(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }

    // --- Webview HTML ---

    private buildHtml(): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'none'; script-src 'nonce-codedock'; style-src 'unsafe-inline';">
    <title>CodeDock Chat</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background: var(--vscode-editor-background);
            margin: 0;
            padding: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
        }
        #messages {
            flex: 1;
            overflow-y: auto;
            padding: 12px;
        }
        .message {
            margin-bottom: 10px;
        }
        .message .author {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
            font-size: 0.85em;
        }
        .message .time {
            color: var(--vscode-descriptionForeground);
            font-size: 0.75em;
            margin-left: 6px;
        }
        .message .content {
            margin-top: 2px;
            word-break: break-word;
        }
        #input-row {
            display: flex;
            padding: 8px;
            gap: 8px;
            border-top: 1px solid var(--vscode-panel-border);
        }
        #input {
            flex: 1;
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            border: 1px solid var(--vscode-input-border);
            padding: 6px 8px;
            font-size: var(--vscode-font-size);
            font-family: var(--vscode-font-family);
        }
        #send {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            padding: 6px 14px;
            cursor: pointer;
        }
        #send:hover {
            background: var(--vscode-button-hoverBackground);
        }
    </style>
</head>
<body>
    <div id="messages"></div>
    <div id="input-row">
        <input id="input" type="text" placeholder="Type a message..." />
        <button id="send">Send</button>
    </div>
    <script nonce="codedock">
        const vscode = acquireVsCodeApi();
        const messagesEl = document.getElementById('messages');
        const inputEl = document.getElementById('input');
        const sendEl = document.getElementById('send');

        function formatTime(ts) {
            return new Date(ts).toLocaleTimeString([], {
                hour: '2-digit', minute: '2-digit'
            });
        }

        function appendMessage(msg) {
            const div = document.createElement('div');
            div.className = 'message';
            // content is already sanitized by the extension host
            div.innerHTML =
                '<div class="author">' + msg.email +
                '<span class="time">' + formatTime(msg.timestamp) + '</span></div>' +
                '<div class="content">' + msg.content + '</div>';
            messagesEl.appendChild(div);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }

        function send() {
            const content = inputEl.value.trim();
            if (!content) return;
            vscode.postMessage({ type: 'send', content });
            inputEl.value = '';
        }

        sendEl.addEventListener('click', send);
        inputEl.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') send();
        });

        window.addEventListener('message', (event) => {
            const msg = event.data;
            if (msg.type === 'append') {
                appendMessage(msg.message);
            }
        });
    </script>
</body>
</html>`
    }
}
