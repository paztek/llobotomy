/*!
 * llobotomy v0.0.2
 * (c) Matthieu Balmes
 * Released under the MIT License.
 */

'use strict';

var EventEmitter = require('events');

const POLLING_INTERVAL = 1000;
class Thread extends EventEmitter {
    constructor(openai, instance) {
        super();
        this.openai = openai;
        this.instance = instance;
        this.pollingIntervalId = null;
    }
    static async create(openai) {
        const instance = await openai.beta.threads.create();
        return new Thread(openai, instance);
    }
    async query(text, assistantId) {
        await this.openai.beta.threads.messages.create(this.instance.id, {
            role: 'user',
            content: text,
        });
        await this.doRun(assistantId);
    }
    stop() {
        // TODO Stop run if in progress
        this.stopRunPolling();
    }
    async doRun(assistantId) {
        const { id: runId } = await this.openai.beta.threads.runs.create(this.instance.id, {
            assistant_id: assistantId,
        });
        this.startRunPolling(runId, POLLING_INTERVAL);
    }
    stopRunPolling() {
        if (this.pollingIntervalId) {
            clearInterval(this.pollingIntervalId);
            this.pollingIntervalId = null;
        }
    }
    startRunPolling(runId, interval) {
        this.pollingIntervalId = setInterval(async () => {
            const run = await this.openai.beta.threads.runs.retrieve(this.instance.id, runId);
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
                    const requiredAction = new RequiredAction(this.openai, this.instance, run, oaiRequiredAction);
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
    async getAssistantMessage() {
        const messages = await this.openai.beta.threads.messages.list(this.instance.id);
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
class RequiredAction extends EventEmitter {
    constructor(openai, thread, run, instance) {
        super();
        this.openai = openai;
        this.thread = thread;
        this.run = run;
        this.instance = instance;
        if (instance.type !== 'submit_tool_outputs') {
            throw new Error('Unsupported required action type');
        }
        this.toolCalls = instance.submit_tool_outputs.tool_calls.map((oaiToolCall) => ({
            id: oaiToolCall.id,
            name: oaiToolCall.function.name,
            arguments: JSON.parse(oaiToolCall.function.arguments),
        }));
    }
    async submitToolOutputs(toolOutputs) {
        await this.openai.beta.threads.runs.submitToolOutputs(this.thread.id, this.run.id, {
            tool_outputs: toolOutputs.map((toolOutput) => ({
                output: JSON.stringify(toolOutput.value),
                tool_call_id: toolOutput.callId,
            })),
        });
        this.emit('submitted');
    }
}

exports.RequiredAction = RequiredAction;
exports.Thread = Thread;
//# sourceMappingURL=index.js.map
