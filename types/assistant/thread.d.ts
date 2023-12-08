/// <reference types="node" />
import EventEmitter from 'events';
import type OpenAI from 'openai';
import type { Thread as BaseThread } from 'openai/resources/beta';
import type { Run as BaseRun } from 'openai/resources/beta/threads';
export declare class Thread extends EventEmitter {
    private readonly openai;
    readonly instance: BaseThread;
    private pollingIntervalId;
    constructor(openai: OpenAI, instance: BaseThread);
    static create(openai: OpenAI): Promise<Thread>;
    query(text: string, assistantId: string): Promise<void>;
    stop(): void;
    private doRun;
    private stopRunPolling;
    private startRunPolling;
    private getAssistantMessage;
}
export declare class RequiredAction extends EventEmitter {
    private readonly openai;
    private readonly thread;
    private readonly run;
    instance: BaseRun.RequiredAction;
    toolCalls: ToolCall[];
    constructor(openai: OpenAI, thread: BaseThread, run: BaseRun, instance: BaseRun.RequiredAction);
    submitToolOutputs(toolOutputs: ToolOutput[]): Promise<void>;
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
//# sourceMappingURL=thread.d.ts.map