import EventEmitter from 'events';
import type OpenAI from 'openai';
import type { Thread as BaseThread } from 'openai/resources/beta';
import type { Run as BaseRun } from 'openai/resources/beta/threads';

const POLLING_INTERVAL = 1000;

export class Thread extends EventEmitter {
    private pollingIntervalId: NodeJS.Timeout | null = null;

    constructor(
        private readonly openai: OpenAI,
        public readonly instance: BaseThread,
    ) {
        super();
    }

    static async create(openai: OpenAI): Promise<Thread> {
        const instance = await openai.beta.threads.create();
        return new Thread(openai, instance);
    }

    async query(text: string, assistantId: string): Promise<void> {
        await this.openai.beta.threads.messages.create(this.instance.id, {
            role: 'user',
            content: text,
        });

        await this.doRun(assistantId);
    }

    stop(): void {
        // TODO Stop run if in progress
        this.stopRunPolling();
    }

    private async doRun(assistantId: string): Promise<void> {
        const { id: runId } = await this.openai.beta.threads.runs.create(
            this.instance.id,
            {
                assistant_id: assistantId,
            },
        );

        this.startRunPolling(runId, POLLING_INTERVAL);
    }

    private stopRunPolling(): void {
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
    }

    private startRunPolling(runId: string, interval: number): void {
        this.pollingIntervalId = setInterval(async () => {
            const run = await this.openai.beta.threads.runs.retrieve(
                this.instance.id,
                runId,
            );

            switch (run.status) {
                case 'queued': {
                    this.emit('queued');
                    break;
                }
                case 'in_progress': {
                    this.emit('in_progress');
                    break;
                }
                case 'requires_action': {
                    if (!run.required_action) {
                        break;
                    }
                    const oaiRequiredAction = run.required_action;
                    const requiredAction = new RequiredAction(
                        this.openai,
                        this.instance,
                        run,
                        oaiRequiredAction,
                    );

                    this.stopRunPolling();

                    requiredAction.once('submitted', () => {
                        this.startRunPolling(runId, interval);
                    });

                    this.emit('requires_action', requiredAction);
                    break;
                }
                case 'cancelling': {
                    this.emit('cancelling');
                    break;
                }
                case 'cancelled': {
                    this.stopRunPolling();
                    this.emit('cancelled');
                    break;
                }
                case 'failed': {
                    this.stopRunPolling();
                    // TODO
                    this.emit('failed');
                    break;
                }
                case 'completed': {
                    this.stopRunPolling();

                    this.emit('completed');

                    // Get the assistant's response
                    const message = await this.getAssistantMessage();
                    this.emit('message', message);

                    break;
                }
                case 'expired': {
                    this.stopRunPolling();
                    this.emit('expired');
                    break;
                }
            }
        }, interval);
    }

    private async getAssistantMessage(): Promise<string> {
        const messages = await this.openai.beta.threads.messages.list(
            this.instance.id,
        );

        // Most recent message is at the beginning of the list
        const message = messages.data[0];

        if (!message || message.role !== 'assistant') {
            throw new Error('No response from assistant');
        }

        if (!message.content[0]) {
            throw new Error('Empty response from assistant');
        }

        if (message.content[0].type !== 'text') {
            throw new Error('Non-text response from assistant');
        }

        return message.content[0].text.value;
    }
}

export class RequiredAction extends EventEmitter {
    toolCalls: ToolCall[];

    constructor(
        private readonly openai: OpenAI,
        private readonly thread: BaseThread,
        private readonly run: BaseRun,
        public instance: BaseRun.RequiredAction,
    ) {
        super();

        if (instance.type !== 'submit_tool_outputs') {
            throw new Error('Unsupported required action type');
        }

        this.toolCalls = instance.submit_tool_outputs.tool_calls.map(
            (oaiToolCall) => ({
                id: oaiToolCall.id,
                name: oaiToolCall.function.name,
                arguments: JSON.parse(oaiToolCall.function.arguments),
            }),
        );
    }

    async submitToolOutputs(toolOutputs: ToolOutput[]): Promise<void> {
        await this.openai.beta.threads.runs.submitToolOutputs(
            this.thread.id,
            this.run.id,
            {
                tool_outputs: toolOutputs.map((toolOutput) => ({
                    output: JSON.stringify(toolOutput.value),
                    tool_call_id: toolOutput.callId,
                })),
            },
        );

        this.emit('submitted');
    }
}

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolOutput {
    callId: string;
    value: unknown;
}
