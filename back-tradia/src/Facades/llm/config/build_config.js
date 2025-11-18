const workersLLM = require("./workersLLM.config")
const fs = require("fs-extra")
const path = require("path")
const PROMPT_DIR = path.join(__dirname, "../prompts")
const BASE_PATH = process.env.BASE_PATH
module.exports = workersLLM.map((worker) => ({
    ...worker,
    prompt: fs.readFileSync(path.join(PROMPT_DIR, worker.prompt), {
        encoding: "utf8"
    }),
    get_prompt: () => {
        const default_prompt = fs.readFileSync(path.join(PROMPT_DIR, worker.prompt), { encoding: "utf8" })
        fs.ensureDirSync(path.join(BASE_PATH, "prompts"))
        const custom_prompt_path = path.join(BASE_PATH, "prompts", worker.prompt)
        const custom_prompt_exist = fs.existsSync(custom_prompt_path)
        if (!custom_prompt_exist) return default_prompt
        if (custom_prompt_exist) return fs.readFileSync(custom_prompt_path, { encoding: "utf8" }) || default_prompt
    },
}))
