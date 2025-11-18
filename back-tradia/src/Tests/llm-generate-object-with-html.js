import { generateObject, NoObjectGeneratedError } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

const { createGoogleGenerativeAI } = require("@ai-sdk/google");
import { z } from "zod";

try {
	const result = await generateObject({
		model: createOpenAI({
			apiKey: process.env.OPENAI_API_KEY,
		})("gpt-4.1"),
		schema: z.object({
			html_raw: z.string().describe("el HTML puro"),
		}),
		prompt: "Saludame",
	});
	Bun.write("/tmp/result.json", JSON.stringify(result, null, 2));
} catch (error) {
    console.error(error.message)
	if (NoObjectGeneratedError.isInstance(error)) {
		console.log("NoObjectGeneratedError");
		console.log("Cause:", error.cause);
		console.log("Text:", error.text);
		console.log("Response:", error.response);
		console.log("Usage:", error.usage);
	}
}
