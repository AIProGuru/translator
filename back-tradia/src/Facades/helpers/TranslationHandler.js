const LLM = require("../../Facades/llm");
const HtmlJoiner = require("../services/documents/joinHtmlDocuments");
const constants = require("../../Api/shared/config/constants");
const FileManagementService = require("../services/documents/file_management");
const ProcessFacade = require("../services/process");
const { parseInt } = require("lodash");
const { injectSignatureImages } = require("./SignatureRegionHandler");

class TranslationHandler {
    constructor() {
        this._htmlJoiner = new HtmlJoiner();
        this._processFacade = new ProcessFacade();
        this._fileManager = new FileManagementService();
    }

    initializeLLM(config, process, processPath) {
        this._llm = new LLM({
            adapter: config.adapter,
            process_dir: processPath,
            process: process,
            prompt: config.prompt,
            language: config.language,
        });
    }
    async continueTranslationProcess({ process, processPath, file, req }) {
        
        try {
            this.initializeLLM(req.body, process, processPath);

            const translations = await this._processTranslations(
                process,
                processPath,
                req.body,
                req.user.id
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
        this._llm = new LLM({
            adapter: config.adapter,
            process_dir: processPath,
            process: process,
            prompt: config.prompt,
            language: config.language,
            auto_correction_cycles: parseInt(config.cycles)
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
        const translations = await Promise.race([
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

        // Inject original signature / mark images into each page HTML
        const enhancedTranslations = [];
        for (let index = 0; index < translations.length; index++) {
            const translation = translations[index];
            const page = pages[index];

            if (!translation || !translation.html || !page) {
                enhancedTranslations.push(translation);
                continue;
            }

            try {
                const htmlWithSignatures = await injectSignatureImages(
                    translation.html,
                    page,
                );
                enhancedTranslations.push({
                    ...translation,
                    html: htmlWithSignatures,
                });
            } catch (error) {
                console.error(
                    "Error injecting signature images into HTML:",
                    error?.message || error,
                );
                enhancedTranslations.push(translation);
            }
        }

        const html_data = enhancedTranslations.map(({ html, page_info }) => {
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

        const pages_info = pages.map(({ page_info }) => page_info);
        await this._processFacade.updateProcess(
            process.id,
            {
                status: constants.PROCESS_STATUS.TRANSLATING,
                message: "Translations done",
                progress: 60,
                config: {
                    adapter: config.adapter,
                    language: config.language,
                },
                html: mergedHtml,
                pages_info,
            },
            userId,
        );
        return enhancedTranslations;
    }

    async _handleProcessError(processId, error, userId) {
        const error_default = "Unknown error"
        const error_msg = error?.message || error_default
        await this._processFacade.updateProcess(processId, {
            status: constants.PROCESS_STATUS.ERROR,
            message: error_msg,
            error: error.message,
        }, userId);
    }
}

module.exports = TranslationHandler;
