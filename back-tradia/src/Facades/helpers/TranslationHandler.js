const LLM = require("../../Facades/llm");
const HtmlJoiner = require("../services/documents/joinHtmlDocuments");
const constants = require("../../Api/shared/config/constants");
const FileManagementService = require("../services/documents/file_management");
const ProcessFacade = require("../services/process");

class TranslationHandler {
	constructor() {
		this._htmlJoiner = new HtmlJoiner();
		this._processFacade = new ProcessFacade();
		this._fileManager = new FileManagementService();
		this._activeConfig = null;
	}

	_extractVisibleText(html) {
		if (!html) return "";
		let text = html
			.replace(/<style[\s\S]*?<\/style>/gi, " ")
			.replace(/<script[\s\S]*?<\/script>/gi, " ")
			.replace(/<[^>]+>/g, " ")
			.replace(/&nbsp;/gi, " ")
			.replace(/&amp;/gi, "&")
			.replace(/&lt;/gi, "<")
			.replace(/&gt;/gi, ">")
			.replace(/&quot;/gi, '"')
			.replace(/&#39;/gi, "'");
		text = text.replace(/\s+/g, " ").trim();
		return text;
	}

	_languageProfiles() {
		return {
			english: {
				stopwords: [
					"the",
					"and",
					"of",
					"to",
					"in",
					"for",
					"on",
					"with",
					"is",
					"that",
					"this",
					"as",
					"by",
					"from",
					"or",
					"be",
					"are",
				],
			},
			spanish: {
				stopwords: [
					"de",
					"la",
					"que",
					"el",
					"en",
					"y",
					"a",
					"los",
					"del",
					"se",
					"las",
					"por",
					"un",
					"para",
					"con",
					"no",
					"una",
					"su",
					"al",
					"lo",
				],
			},
			french: {
				stopwords: [
					"de",
					"la",
					"et",
					"les",
					"des",
					"en",
					"un",
					"une",
					"du",
					"pour",
					"que",
					"qui",
					"dans",
					"au",
					"aux",
					"est",
					"sur",
				],
			},
			german: {
				stopwords: [
					"der",
					"die",
					"und",
					"in",
					"den",
					"von",
					"zu",
					"das",
					"mit",
					"sich",
					"des",
					"auf",
					"fur",
					"ist",
					"im",
					"dem",
					"nicht",
					"ein",
				],
			},
			italian: {
				stopwords: [
					"di",
					"e",
					"che",
					"la",
					"il",
					"in",
					"un",
					"una",
					"per",
					"del",
					"dei",
					"della",
					"delle",
					"da",
					"con",
					"su",
					"al",
				],
			},
			portuguese: {
				stopwords: [
					"de",
					"a",
					"o",
					"que",
					"e",
					"do",
					"da",
					"em",
					"um",
					"para",
					"com",
					"nao",
					"uma",
					"os",
					"no",
					"se",
					"na",
				],
			},
		};
	}

	_countScriptMatches(text, regex) {
		const matches = text.match(regex);
		return matches ? matches.length : 0;
	}

	_shouldRetryTranslation(text, targetLanguage) {
		if (!text) return false;
		const normalized = text.toLowerCase();
		const words = normalized.match(/[a-z\u00c0-\u024f]+/gi) || [];
		const alphaWordCount = words.length;
		if (alphaWordCount < 12) {
			return false;
		}

		const target = (targetLanguage || "").toLowerCase();

		if (target === "chinese") {
			return (
				this._countScriptMatches(text, /[\u4e00-\u9fff]/g) < 3
			);
		}
		if (target === "japanese") {
			return (
				this._countScriptMatches(text, /[\u3040-\u30ff]/g) < 3
			);
		}
		if (target === "arabic") {
			return (
				this._countScriptMatches(text, /[\u0600-\u06ff]/g) < 3
			);
		}
		if (target === "russian") {
			return (
				this._countScriptMatches(text, /[\u0400-\u04ff]/g) < 3
			);
		}

		const profiles = this._languageProfiles();
		const profile = profiles[target];
		if (!profile) return false;

		const stopwords = new Set(profile.stopwords);
		let hits = 0;
		for (const word of words) {
			const normalizedWord = word
				.toLowerCase()
				.normalize("NFD")
				.replace(/[\u0300-\u036f]/g, "");
			if (stopwords.has(normalizedWord)) hits += 1;
		}
		return hits < 2;
	}

	_buildLanguageRetryPrompt(targetLanguage) {
		const languageLabel = targetLanguage || "the target language";
		return `${this._activeConfig?.prompt || ""}\n\nIMPORTANT: The output must be written in ${languageLabel}. Do not keep the source language. If a section appears to be already in the target language, still rewrite it in ${languageLabel} and keep the meaning.`;
	}

	async _retryTranslationsIfNeeded({
		translations,
		pages,
		process,
		processPath,
	}) {
		const targetLanguage = this._activeConfig?.language || "spanish";
		const retryPageNumbers = [];

		for (const item of translations) {
			const text = this._extractVisibleText(item.html);
			if (this._shouldRetryTranslation(text, targetLanguage)) {
				retryPageNumbers.push(item.page_info.pageNumber);
			}
		}

		if (!retryPageNumbers.length) return translations;

		const retryPages = pages.filter((page) =>
			retryPageNumbers.includes(page.page_info.pageNumber),
		);
		if (!retryPages.length) return translations;

		const retryLLM = new LLM({
			adapter: this._activeConfig?.adapter || "openai",
			process_dir: processPath,
			process: process,
			prompt: this._buildLanguageRetryPrompt(targetLanguage),
			language: targetLanguage,
			auto_correction_cycles: this._activeConfig?.cycles || 0,
		});
		const retriedTranslations = await retryLLM.run(retryPages);
		const retriedByPage = new Map(
			retriedTranslations.map((t) => [t.page_info.pageNumber, t]),
		);

		return translations.map(
			(t) => retriedByPage.get(t.page_info.pageNumber) || t,
		);
	}

	async continueTranslationProcess({ process, processPath, file, req }) {
		try {
			this.initializeLLM(req.body, process, processPath);

			const translations = await this._processTranslations(
				process,
				processPath,
				req.body,
				req.user.id,
			);

			if (!Array.isArray(translations)) {
				console.error(
					"[FINALIZE] Las traducciones no son un array válido:",
					translations,
				);
				throw new Error("Traducciones inválidas");
			}

			return {
				message: "Proceso de traducción completado",
				processId: process.id,
				translationsCount: translations.length,
			};
		} catch (error) {
			const userId = req.user.id;
			await this._handleProcessError(process.id, error, userId);
			console.error("Error en traducción posterior a conversión:", error);
			throw error;
		}
	}

	initializeLLM(config, process, processPath) {
		this._activeConfig = this._normalizeTranslationConfig(config, process);
		this._llm = new LLM({
			adapter: this._activeConfig.adapter,
			process_dir: processPath,
			process: process,
			prompt: this._activeConfig.prompt,
			language: this._activeConfig.language,
			auto_correction_cycles: this._activeConfig.cycles,
		});
	}

	async _processTranslations(process, processPath, config, userId) {
		if (!this._llm) {
			throw new Error("Error on init LLM");
		}

		const pages = await this._fileManager.getImagesFromPath(processPath);
		if (!pages || pages.length === 0) {
			throw new Error("Pages to translate not found");
		}

		const hours = 10;
		let translations = await Promise.race([
			this._llm.run(pages),
			new Promise((_, reject) =>
				setTimeout(
					() =>
						reject(
							new Error(
								"Timeout Error when translations pages width LLM",
							),
						),
					hours * 60 * 60 * 1000,
				),
			),
		]);
		console.log("Traducciones obtenidas con éxito");
		if (!translations || translations.length === 0) {
			throw new Error("Error: translations results is empty");
		}
		translations = await this._retranslatePagesIfNeeded({
			process,
			processPath,
			config: this._activeConfig,
			pages,
			translations,
		});

		// Do NOT inject or replace any image regions; use the HTML exactly as returned by the LLM.
		const html_data = translations.map(({ html, page_info }) => {
			return {
				html,
				html_info: {
					page_number: page_info.pageNumber,
					dimensions: page_info.dimensions,
				},
			};
		});
		const mergedHtml = this._htmlJoiner.join(html_data);

		if (!mergedHtml) {
			throw new Error("Error al unir documentos HTML");
		}

		const runtimeConfig =
			this._activeConfig ||
			this._normalizeTranslationConfig(config, process);
		const mergedConfig = this._buildProcessConfigSnapshot(
			process.config,
			runtimeConfig,
		);

		const pages_info = pages.map(({ page_info }) => page_info);
		await this._processFacade.updateProcess(
			process.id,
			{
				status: constants.PROCESS_STATUS.TRANSLATING,
				message: "Translations done",
				progress: 60,
				config: mergedConfig,
				html: mergedHtml,
				pages_info,
			},
			userId,
		);
		return translations;
	}

	async generatePreviewTranslation({ process, processPath, config, maxPages }) {
		if (!this._llm) {
			throw new Error("Error on init LLM");
		}

		const pages = await this._fileManager.getImagesFromPath(processPath);
		if (!pages || pages.length === 0) {
			throw new Error("Pages to translate not found");
		}

		const safeLimit =
			Number.isFinite(maxPages) && maxPages > 0 ? maxPages : pages.length;
		const previewPages = pages.slice(0, safeLimit);

		const hours = 10;
		let translations = await Promise.race([
			this._llm.run(previewPages),
			new Promise((_, reject) =>
				setTimeout(
					() =>
						reject(
							new Error(
								"Timeout Error when translations pages width LLM",
							),
						),
					hours * 60 * 60 * 1000,
				),
			),
		]);
		if (!translations || translations.length === 0) {
			throw new Error("Error: translations results is empty");
		}
		translations = await this._retryTranslationsIfNeeded({
			translations,
			pages: previewPages,
			process,
			processPath,
		});
		translations = await this._retryTranslationsIfNeeded({
			translations,
			pages,
			process,
			processPath,
		});

		const html_data = translations.map(({ html, page_info }) => {
			return {
				html,
				html_info: {
					page_number: page_info.pageNumber,
					dimensions: page_info.dimensions,
				},
			};
		});
		const mergedHtml = this._htmlJoiner.join(html_data);

		if (!mergedHtml) {
			throw new Error("Error al unir documentos HTML");
		}

		const pages_info = previewPages.map(({ page_info }) => page_info);

		return {
			html: mergedHtml,
			pages_info,
			previewPageCount: previewPages.length,
			translationsCount: translations.length,
		};
	}

	_normalizeTranslationConfig(config = {}, process) {
		const previousTranslation = process?.config?.translation || {};
		const adapter =
			config.adapter ||
			previousTranslation.adapter ||
			"openai";
		const language = this._normalizeLanguageName(
			config.language ||
				previousTranslation.language ||
				"spanish",
		);
		const cycles = this._toInteger(
			config.cycles,
			previousTranslation.cycles,
			0,
		);
		const documentType = this._buildDocumentTypeConfig(
			config.documentType,
			previousTranslation.documentType,
		);
		const baseUserPrompt = (
			(config.prompt ?? null) ??
			previousTranslation.prompt ??
			""
		).trim();
		const userPrompt = this._enforceLanguagePrompt(baseUserPrompt, language);
		const templatePrompt =
			previousTranslation.templatePrompt ||
			documentType.prompt ||
			"";
		const mergedPrompt = this._mergePrompts(
			templatePrompt,
			userPrompt,
		);

		return {
			adapter,
			language,
			cycles,
			prompt: mergedPrompt,
			userPrompt,
			templatePrompt,
			documentType,
		};
	}

	_normalizeLanguageName(value) {
		const raw = (value || "").toString().trim();
		const key = raw.toLowerCase();
		const map = {
			english: "English",
			spanish: "Spanish",
			french: "French",
			german: "German",
			italian: "Italian",
			portuguese: "Portuguese",
			chinese: "Chinese",
			japanese: "Japanese",
			russian: "Russian",
			arabic: "Arabic",
		};
		if (map[key]) return map[key];
		return raw
			.split(" ")
			.map((part) =>
				part.length ? part[0].toUpperCase() + part.slice(1).toLowerCase() : "",
			)
			.join(" ");
	}

	_enforceLanguagePrompt(existingPrompt, language) {
		const enforcement = `\n\nIMPORTANT: Translate ALL text into ${language}. Do NOT leave any source-language text in the output. If a sentence is already in another language, rewrite it in ${language} anyway.\n`;
		if (!existingPrompt) return enforcement.trim();
		if (existingPrompt.includes("Translate ALL text into")) return existingPrompt;
		return `${existingPrompt}${enforcement}`;
	}

	_buildDocumentTypeConfig(inputDocType = {}, fallback = {}) {
		const source = inputDocType && Object.keys(inputDocType).length
			? inputDocType
			: fallback || {};
		return {
			id: source.id ?? null,
			key: source.key || source.id || "custom",
			label: source.label || "Custom",
			version: this._toInteger(source.version, 1),
			prompt: source.prompt || "",
			glossary: Array.isArray(source.glossary) ? source.glossary : [],
			styleGuidance: Array.isArray(source.styleGuidance)
				? source.styleGuidance
				: source.style_guidance || [],
			examples: Array.isArray(source.examples) ? source.examples : [],
		};
	}

	_mergePrompts(templatePrompt, userPrompt) {
		const base = templatePrompt?.trim();
		const custom = userPrompt?.trim();
		if (base && custom && base === custom) {
			return base;
		}
		if (base && custom && custom.includes(base)) {
			return custom;
		}
		if (base && custom) {
			return `${base}\n\n---\nAdditional user instructions:\n${custom}`;
		}
		return custom || base || "Translate the document faithfully.";
	}

	_toInteger(...values) {
		for (const value of values) {
			const parsed = Number.parseInt(value, 10);
			if (!Number.isNaN(parsed)) {
				return parsed;
			}
		}
		return 0;
	}

	_buildProcessConfigSnapshot(existingConfig = {}, translationConfig) {
		const baseConfig =
			existingConfig && typeof existingConfig === "object"
				? { ...existingConfig }
				: {};
		return {
			...baseConfig,
			translation: {
				...(baseConfig.translation || {}),
				adapter: translationConfig.adapter,
				language: translationConfig.language,
				cycles: translationConfig.cycles,
				prompt: translationConfig.userPrompt,
				templatePrompt: translationConfig.templatePrompt,
				mergedPrompt: translationConfig.prompt,
				documentType: translationConfig.documentType,
			},
		};
	}

	async generatePreview(process, processPath, config, userId, pageLimit = 3) {
		this.initializeLLM(config, process, processPath);

		const pages = await this._fileManager.getImagesFromPath(processPath);
		if (!pages || pages.length === 0) {
			throw new Error("Pages to translate not found");
		}

		const previewPages = pages.slice(0, pageLimit);
		let translations = await this._llm.run(previewPages);
		if (!translations || translations.length === 0) {
			throw new Error("Preview translations results is empty");
		}

		translations = await this._retranslatePagesIfNeeded({
			process,
			processPath,
			config: this._activeConfig,
			pages: previewPages,
			translations,
		});

		const html_data = translations.map(({ html, page_info }) => {
			return {
				html,
				html_info: {
					page_number: page_info.pageNumber,
					dimensions: page_info.dimensions,
				},
			};
		});

		const mergedHtml = this._htmlJoiner.join(html_data);
		if (!mergedHtml) {
			throw new Error("Error al unir documentos HTML");
		}

		const runtimeConfig =
			this._activeConfig ||
			this._normalizeTranslationConfig(config, process);
		const mergedConfig = this._buildProcessConfigSnapshot(
			process.config,
			runtimeConfig,
		);

		const pages_info = previewPages.map(({ page_info }) => page_info);
		await this._processFacade.updateProcess(
			process.id,
			{
				status: constants.PROCESS_STATUS.PREVIEW_READY,
				message: "Preview translation ready",
				config: {
					...mergedConfig,
					previewTranslation: {
						html: mergedHtml,
						pages_info,
						pageLimit,
						generatedAt: new Date().toISOString(),
					},
				},
			},
			userId,
		);

		return {
			html: mergedHtml,
			pages_info,
			pageLimit,
		};
	}

	async _retranslatePagesIfNeeded({ process, processPath, config, pages, translations }) {
		const targetLanguage = config?.language || "English";
		if (this._isCjkTargetLanguage(targetLanguage)) {
			return translations;
		}

		const pagesToRetry = translations
			.filter(({ html }) => this._shouldForceRetranslate(html, targetLanguage))
			.map(({ page_info }) => page_info.pageNumber);

		if (!pagesToRetry.length) {
			return translations;
		}

		const retryPages = pages.filter((page) =>
			pagesToRetry.includes(page.page_info.pageNumber),
		);

		if (!retryPages.length) {
			return translations;
		}

		const retryPrompt = this._buildRetranslationPrompt(
			config?.prompt || "",
			targetLanguage,
		);

		const retryLLM = new LLM({
			adapter: config?.adapter || "openai",
			process_dir: processPath,
			process,
			prompt: retryPrompt,
			language: targetLanguage,
			auto_correction_cycles: config?.cycles || 0,
		});

		const retriedTranslations = await retryLLM.run(retryPages);
		if (!retriedTranslations || retriedTranslations.length === 0) {
			return translations;
		}

		const retryMap = new Map(
			retriedTranslations.map((entry) => [entry.page_info.pageNumber, entry]),
		);

		return translations.map((entry) =>
			retryMap.get(entry.page_info.pageNumber) || entry,
		);
	}

	_isCjkTargetLanguage(targetLanguage = "") {
		const normalized = targetLanguage.toLowerCase();
		return ["chinese", "japanese", "korean"].some((lang) =>
			normalized.includes(lang),
		);
	}

	_shouldForceRetranslate(html, targetLanguage) {
		if (!html) return false;
		const text = html.replace(/<[^>]*>/g, " ");
		const hanMatches = text.match(/[\p{Script=Han}]/gu) || [];
		const cjkCount = hanMatches.length;
		if (cjkCount === 0) return false;
		const letters = text.match(/[A-Za-z]/g) || [];
		const letterCount = letters.length;
		const ratio = letterCount > 0 ? cjkCount / letterCount : cjkCount;
		return cjkCount >= 20 || ratio > 0.05;
	}

	_buildRetranslationPrompt(basePrompt, language) {
		const strict =
			`\n\nABSOLUTE REQUIREMENT: Output must be entirely in ${language}. ` +
			`Do NOT keep any source-language text. If you see Chinese/Japanese/Korean characters, ` +
			`you MUST translate them into ${language}. Never output bilingual text.\n`;
		if (!basePrompt) return strict.trim();
		if (basePrompt.includes("ABSOLUTE REQUIREMENT")) return basePrompt;
		return `${basePrompt}${strict}`;
	}

	async _handleProcessError(processId, error, userId) {
		const error_default = "Unknown error";
		const error_msg = error?.message || error_default;
		await this._processFacade.updateProcess(
			processId,
			{
				status: constants.PROCESS_STATUS.ERROR,
				message: error_msg,
				error: error.message,
			},
			userId,
		);
	}
}

module.exports = TranslationHandler;
