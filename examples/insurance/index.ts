import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import chalk from 'chalk';
import * as readline from 'readline/promises';
import { stdin, stdout } from 'process';

import profiles from './customer-profiles.json';
import knowledges from './knowledge-base.json';
import products from './products.json';
import { Thread, type FunctionTool, type RequiredAction } from '../../src';

dotenv.config();

const apiKey = process.env['OPENAI_API_KEY'] as string;
const assistantId = process.env['OPENAI_ASSISTANT_ID'] as string;

run();

async function run() {
    console.log(chalk.blue('Running...'));

    const openai = new OpenAI({
        apiKey,
    });

    const tools = new Map<string, FunctionTool>();

    tools.set('get_customer_profile', {
        execute: async function (params: Record<string, unknown>) {
            console.log(
                chalk.yellow(
                    'Using tool get_customer_profile with arguments',
                    JSON.stringify(params),
                ),
            );
            const id = params['id'] as string;
            try {
                return await getCustomerProfile(id);
            } catch (e) {
                console.error(e);
                if (e instanceof ProfileNotFoundError) {
                    return e.message;
                }
                throw e;
            }
        },
    });

    tools.set('search_knowledge_base', {
        execute(params: Record<string, unknown>) {
            console.log(
                chalk.yellow(
                    'Using tool search_knowledge_base with arguments',
                    JSON.stringify(params),
                ),
            );
            const query = params['query'] as string;
            return searchKnowledgeBase(query);
        },
    });

    tools.set('consult_product_catalog', {
        execute: async function (params: Record<string, unknown>) {
            console.log(
                chalk.yellow(
                    'Using tool consult_product_catalog with arguments',
                    JSON.stringify(params),
                ),
            );
            const id = params['id'] as string;
            return searchProductCatalog(id);
        },
    });

    const rl = readline.createInterface({ input: stdin, output: stdout });

    console.log(chalk.blue('Creating thread...'));
    const thread = await Thread.create(openai);
    console.log(chalk.blue('Thread created'));

    thread.on('requires_action', async (requiredAction: RequiredAction) => {
        console.log(chalk.blue('Thread requires action'));

        const toolOutputs = await Promise.all(
            requiredAction.toolCalls.map(async (toolCall) => {
                const tool = tools.get(toolCall.name);

                if (!tool) {
                    throw new Error(`Unknown tool ${toolCall.name}`);
                }

                const result = await tool.execute(toolCall.arguments);

                return {
                    callId: toolCall.id,
                    value: result,
                };
            }),
        );

        console.log(chalk.red('Submitting tool outputs...'));

        await requiredAction.submitToolOutputs(toolOutputs);
    });

    thread.on('queued', () => {
        console.log(chalk.blue('Thread queued'));
    });

    thread.on('in_progress', () => {
        console.log(chalk.blue('Thread in progress'));
    });

    thread.on('cancelling', () => {
        console.log(chalk.blue('Thread cancelling'));
    });

    thread.on('cancelled', () => {
        console.log(chalk.blue('Thread cancelled'));
    });

    thread.on('failed', () => {
        console.log(chalk.blue('Thread failed'));
    });

    thread.on('completed', () => {
        console.log(chalk.blue('Thread completed'));
    });

    thread.on('expired', () => {
        console.log(chalk.blue('Thread expired'));
    });

    thread.on('message', (message: string) => {
        console.log(chalk.green('Assistant:', message));
    });

    async function askQuery(): Promise<void> {
        const query = await rl.question(chalk.green('Query: '));
        await thread.query(query, assistantId);
        await new Promise((resolve, reject) => {
            thread.on('error', reject);
            thread.on('message', resolve);
        });
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
        await askQuery();
    }
}

interface CustomerProfile {
    id: string;
    name: string;
    contracts: Contract[];
}

interface Contract {
    id: string;
    name: string;
    formula: string;
}

interface Product {
    id: string;
    name: string;
    formulas?: Formula[];
    coverages?: string[];
}

interface Formula {
    name: string;
    coverages?: string[];
}

async function getCustomerProfile(id: string): Promise<CustomerProfile> {
    const profile = profiles.find((p) => p.id === id);

    if (!profile) {
        throw new ProfileNotFoundError(id);
    }

    return profile;
}

class ProfileNotFoundError extends Error {
    constructor(id: string) {
        super(`Profile ${id} not found`);
    }
}

async function searchKnowledgeBase(query: string): Promise<string> {
    if (query.toLowerCase().includes('franchise')) {
        return knowledges[0] as string;
    } else if (query.toLowerCase().includes('exclusion')) {
        return knowledges[1] as string;
    } else {
        return knowledges[2] as string;
    }
}

async function searchProductCatalog(id: string): Promise<Product> {
    const product = products.find((p) => p.id === id);

    if (!product) {
        throw new Error(`Product ${id} not found`);
    }

    return product;
}
