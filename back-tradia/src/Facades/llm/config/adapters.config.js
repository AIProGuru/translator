const path = require("path");
const dotenv = require("dotenv");
dotenv.config();
module.exports = {
    openai: {
        model: "gpt-4.1",
        adapter: "openai",
        provider: "openai",
        simultaneous_request: 50,
        simultaneous_requests_max: 800,
        auto_correction_cycles: 1,
        auto_correction_cycles_max: 5,
        api_key: process.env.OPENAI_API_KEY,
        maxRetries: 2,
    },
    google: {
        model: "gemini-2.5-pro-preview-05-06",
        adapter: "google",
        provider: "google",
        simultaneous_request: 50,
        simultaneous_requests_max: 200,
        auto_correction_cycles: 2,
        auto_correction_cycles_max: 5,
        api_key: process.env.GEMINI_API_KEY,
        maxTokens: 32000,
        maxRetries: 2,
    },
    anthropic: {
        model: "claude-3-7-sonnet-20250219",
        adapter: "anthropic",
        provider: "anthropic",
        simultaneous_request: 1,
        simultaneous_requests_max: 5,
        auto_correction_cycles: 0,
        auto_correction_cycles_max: 1,
        api_key: process.env.ANTHROPIC_API_KEY,
        maxRetries: 0,
        maxTokens: 16000,
        providerOptions: {
            anthropic: {
                thinking: { type: "disabled", max_tokens: 1024 },
            },
        },
    },
};
