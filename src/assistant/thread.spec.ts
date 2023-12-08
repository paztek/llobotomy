import { mock, mockDeep } from 'jest-mock-extended';
import OpenAI from 'openai';
import type { Thread as BaseThread } from 'openai/resources/beta';
import type { Run } from 'openai/resources/beta/threads';
import { Thread } from './thread';

describe('Thread', () => {
    let thread: Thread;

    const openai = mockDeep<OpenAI>();

    const assistantId = 'asst_abc123';

    beforeEach(() => {
        jest.resetAllMocks();
    });

    describe('create', () => {
        const oaiThread = mock<BaseThread>();

        beforeEach(() => {
            openai.beta.threads.create.mockResolvedValue(oaiThread);
        });

        it('creates a thread', async () => {
            thread = await Thread.create(openai);
            expect(thread).toBeDefined();
            expect(thread.instance).toEqual(oaiThread);
        });
    });

    describe('query', () => {
        const oaiThread = mock<BaseThread>({
            id: 'thread_abc123',
        });
        const oaiRun = mock<Run>({ status: 'queued' });

        beforeEach(() => {
            thread = new Thread(openai, oaiThread);
            openai.beta.threads.runs.create.mockResolvedValue(oaiRun);
            openai.beta.threads.runs.retrieve.mockResolvedValue(oaiRun);
        });

        afterEach(() => {
            thread.stop();
        });

        it('adds a message to the thread', async () => {
            await thread.query('text', assistantId);
            expect(openai.beta.threads.messages.create).toHaveBeenCalledWith(
                oaiThread.id,
                {
                    role: 'user',
                    content: 'text',
                },
            );
        });

        it('runs the thread', async () => {
            await thread.query('text', assistantId);
            expect(openai.beta.threads.runs.create).toHaveBeenCalledWith(
                oaiThread.id,
                {
                    assistant_id: assistantId,
                },
            );
        });
    });
});
