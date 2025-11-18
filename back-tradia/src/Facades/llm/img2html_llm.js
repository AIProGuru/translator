const { createOpenAI } = require("@ai-sdk/openai");
const { createAnthropic } = require("@ai-sdk/anthropic");
const { createGoogleGenerativeAI } = require("@ai-sdk/google");
const { generateText } = require("ai");
const Mustache = require("mustache");
const z = require("zod");
const fs = require("fs-extra");
const config = require("./config");

class Img2Html {
	static INPUT_SCHEMA = z.object({
		image: z.object({
			path: z.string(),
		}),
		page_info: z.object({
			pageNumber: z.number(),
			dimensions: z.object({
				width: z.number(), //px
				height: z.number(), //px
			}),
		}),
		llm_config: z.object({
			model: z.string(),
			adapter: z.enum(["openai", "google", "anthropic"]),
			api_key: z.string(),
			maxRetries: z.number().default(1),
			auto_correction_cycles: z.number().default(0),
			prompt: z.string(),
		}),
	});
	constructor(input) {
		this.config = Img2Html.INPUT_SCHEMA.parse(input);
		this.prompt = this.config.llm_config.prompt;
	}
	async run() {
		const prompt = this._build_prompt();
		const messages = this._build_messages(prompt);
		const provider_config = this._build_provider_config();
		const response = await generateText({
			...provider_config,
			messages,
		});
		if (!response.text)
			throw new Error(
				`Algo salió mal al intentar convertir Img2Html con la imagen: ${this.config.image.path}`,
			);
		const html = this._extract_html_code_block(response.text);
		return {
			html,
			page_info: this.config.page_info,
		};
	}

	_extract_html_code_block(text) {
		// TODO: esto puede fallar porque no todas las respuestas de la AI serán así
		const html = text.replace("```html", "").replaceAll("```", "");
		return html;
	}
	_build_provider_config() {
		const provider = this.config.llm_config.adapter;
		let createProvider;
		switch (provider) {
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
			throw new Error(`Provider with name ${provider} is not compatible`);
		return {
			model: createProvider({
				apiKey: this.config.llm_config.api_key,
			})(this.config.llm_config.model),
			maxRetries: this.config.llm_config.maxRetries,
		};
	}
	_build_messages(prompt) {
		const image_path = this.config.image.path;
		return [
			{
				role: "system",
				content: prompt,
			},
			{
				role: "user",
				content: [
					{
						type: "image",
						image: fs.readFileSync(image_path),
					},
				],
			},
		];
	}
	_build_prompt() {
		return Mustache.render(this.prompt, {
			page_index: this.config.page_info.pageNumber,
			width: this.config.page_info.dimensions.width,
			height: this.config.page_info.dimensions.height,
		});
	}
}
module.exports = Img2Html;
