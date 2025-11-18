const { createOpenAI } = require("@ai-sdk/openai");
const { createAnthropic } = require("@ai-sdk/anthropic");
const { createGoogleGenerativeAI } = require("@ai-sdk/google");
const { generateObject } = require("ai");
const fs = require("fs-extra");
const z = require("zod");
const adapters = require("../config/adapters.config");

class LLM_WRAPPER {
    static schema = z.object({
        adapter: z.enum(["openai", "google", "anthropic"]),
    });
    constructor(input) {
        this.input = LLM_WRAPPER.schema.parse(input);
        this.adapter = adapters[this.input.adapter];
        this.provider_config = this._build_provider_config(this.input.adapter);
    }
    async generate_object({ schema, messages }) {
        try {
            const response = await generateObject({
                ...this.provider_config,
                schema,
                messages,
            });
            return response.object;
        } catch (error) {

            console.dir(error, {depth: null})
        }
    }
    add_message({ messages, role, image, text }) {
        messages = Array.isArray(messages) ? messages : [];
        let result = [...messages];
        let content = [];
        if (text) {
            content.push({
                type: "text",
                text,
            });
        }
        if (image) {
            content.push({
                type: "image",
                image: fs.readFileSync(image),
            });
        }
        result.push({
            role,
            content,
        });
        return result
    }
    add_system_prompt({ system_prompt, messages }) {
        messages = Array.isArray(messages) ? messages : [];
        return [
            {
                role: "system",
                content: system_prompt,
            },
            ...messages,
        ];
    }
    _build_provider_config(adapter_name) {
        const adapter = adapters[adapter_name];
        let createProvider;
        switch (adapter_name) {
            case "openai":
                createProvider = createOpenAI;
                break;
            case "google":
                createProvider = createGoogleGenerativeAI;
                break;
            case "anthropic":
                createProvider = createAnthropic;
                break;
        }
        if (!createProvider)
            throw new Error(
                `LLM adapter_name with name ${adapter_name} is not compatible`,
            );
        let provider_config = {
            model: createProvider({
                apiKey: adapter.api_key,
            })(adapter.model),
            maxRetries: adapter.maxRetries,
        };
        if (adapter.providerOptions)
            provider_config.providerOptions = adapter.providerOptions;
        if (adapter.maxTokens)
            provider_config.maxTokens = adapter.maxTokens;
        return provider_config;
    }
}
module.exports = LLM_WRAPPER;
