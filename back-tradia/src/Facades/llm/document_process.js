const { z } = require("zod");
const _ = require("lodash");
const LLM_WRAPPER = require("./utils/llm")
const PAGE_PROCESS_CHAIN = require("./page_process_chain");
const ADAPTERS = require("./config/adapters.config");
class DOCUMENT_PROCESS {
    static CONSTRUCTOR_SCHEMA = z.object({
        adapter: z.enum(["openai", "google", "anthropic"]),
        process: z.any(),
        process_dir: z.string(),
        prompt: z.string(),
        language: z.string(),
        auto_correction_cycles: z.number().default(0),
    });
    static RUN_SCHEMA = z.array(
        z.object({
            image: z.object({
                path: z.string(),
            }),
            page_info: z.object({
                pageNumber: z.number(),
                filename: z.string(),
                dimensions: z.object({
                    width: z.number(),
                    height: z.number(),
                }),
            }),
        }),
    );
    constructor(input) {
        this.input = DOCUMENT_PROCESS.CONSTRUCTOR_SCHEMA.parse(input);
        this.adapter = ADAPTERS[this.input.adapter];
        this.llm = new LLM_WRAPPER({ adapter: this.input.adapter })
        this.process = this.input.process
    }

    async run(pages) {
        pages = DOCUMENT_PROCESS.RUN_SCHEMA.parse(pages);
        const input_pages_process_chain =
            this._build_input_pages_process_chain(pages);
        const chunks = this._chunking(input_pages_process_chain);
        const results = await this._chunk_by_chunk(chunks);
        const translations = results.map(({ html, page }) => ({
            html,
            page_info: {
                pageNumber: page.page_number,
                dimensions: page.dimensions
            }
        }))
        return translations
    }
    async _simultaneous_request(input_page_process_chain_list) {
        let promises = [];
        for (const page_process of input_page_process_chain_list) {
            const img2html = new PAGE_PROCESS_CHAIN(page_process);
            promises.push(img2html.run());
        }
        return await Promise.all(promises);
    }
    async _chunk_by_chunk(chunks) {
        let results = [];
        for (let index = 0; index < chunks.length; index++) {
            const chunk = chunks[index];
            const result_chunk = await this._simultaneous_request(chunk);
            results.push(...result_chunk);
            this._send_status( `Translate ${results.length}/${chunk.length * chunks.length}`)
        }
        return results;
    }
    _send_status(message){
        try {
           this.process.update({message}) 
        } catch (error) { }
    }
    _chunking(pages) {
        const chunk_size = this.adapter.simultaneous_request;
        return _.chunk(pages, chunk_size);
    }
    _build_input_pages_process_chain(pages) {
        return pages.map((page) => {
            return {
                process: {
                    process_model: this.input.process,
                    process_dir: this.input.process_dir,
                    params: {
                        auto_correction_cycles:
                            this.input.auto_correction_cycles,
                        user_prompt: this.input.prompt,
                        language: this.input.language,
                    },
                },
                page: {
                    image_path: page.image.path,
                    dimensions: page.page_info.dimensions,
                    page_number: page.page_info.pageNumber,
                },
                llm: this.llm
            };
        });
    }
}

module.exports = DOCUMENT_PROCESS;
