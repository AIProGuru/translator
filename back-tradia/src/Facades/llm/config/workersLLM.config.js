const path = require("path");
const dotenv = require("dotenv");
const { z } = require("zod");
const fs = require("fs-extra");
dotenv.config();

module.exports = [
	{
		name: "traductor_html",
		description:
			"Traduce la imagen que se le pone como input respetando el formato y dando una salida HTML",
		prompt: "1.0_traductor_prompt.md",
		use_history: true,
		on_init: async (
			last_response,
			{
				chain,
				history,
				set_history,
				prev_workersLLM,
				current_workerLLM,
				process_config,
				page,
				utils,
				get_answer_of_chainLLM,
				set_answer_of_chainLLM,
				stop_chain,
			},
		) => {
			if (!page.image_path)
				throw new Error("Image of the page is required");
			const new_messages = utils.add_user_message(history, {
				image: page.image_path,
			});
			set_history(new_messages);
		},
		schema: z.object({
			html: z.string().describe("Pure HTML response"),
		}),
		on_finish: async (
			response,
			{
				chain,
				history,
				prev_workersLLM,
				current_workerLLM,
				process_config,
				page,
				utils,
				get_answer_of_chainLLM,
				set_answer_of_chainLLM,
				stop_chain,
			},
		) => {
			if (!response.html)
				throw new Error(`The LLM no generate respone.html`);
			const answer = response.html;
			set_answer_of_chainLLM(answer);
			const cycles = process_config.params.auto_correction_cycles;
			const current_cycle = chain.cycle_index;
			if (cycles === 0) return stop_chain();
			if (current_cycle === cycles) return stop_chain();
		},
	},
	{
		name: "need_correction",
		description:
			"Determina si el HTML generado anteriormente necesita correcion, convirtiendo HTML a IMG para poder pasarle el resultado visual al LLM",
		prompt: "1.0_need_correction_prompt.md",
		use_history: true,
		schema: z.object({
			reasoning: z
				.string()
				.describe("Razona el control de calidad del documento"),
			need_correction: z.boolean(),
		}),
		on_init: async (
			last_response,
			{
				history,
				set_history,
				prev_workersLLM,
				chain,
				current_workerLLM,
				process_config,
				page,
				utils,
				get_answer_of_chainLLM,
				set_answer_of_chainLLM,
				stop_chain,
			},
		) => {
			const last_html = get_answer_of_chainLLM();
			const worker_dir = path.join(
				process_config.process_dir,
				"need_correction",
				`page-${page.page_number}`,
			);
			await fs.ensureDir(worker_dir);
			const path_img_of_html = path.join(
				worker_dir,
				`${chain.cycle_index}.png`,
			);
			const path_html_of_this_step = path.join(
				worker_dir,
				`${chain.cycly_index}.html`,
			);
			const html_parsed = utils.joiner_html.join([
				{
					html: last_html,
					html_info: page,
				},
			]);
			let image_path;
			try {
				const result_image = await utils.html2img(
					html_parsed,
					path_img_of_html,
					page.dimensions,
				);
				image_path = result_image.image_path;

				fs.writeFile(path_html_of_this_step, last_html);
			} catch (error) {
				console.log(
					`${current_workerLLM.name} Error, get image from html2img, so stopChain`,
				);
				return stop_chain();
			}
			const new_messages = utils.add_user_message(history, {
				image: image_path,
			});
			set_history(new_messages);
		},

		on_finish: async (
			response,
			{
				history,
				set_history,
				prev_workersLLM,
				current_workerLLM,
				process_config,
				page,
				utils,
				get_answer_of_chainLLM,
				set_answer_of_chainLLM,
				stop_chain,
			},
		) => {
			const schema = current_workerLLM.schema;
			const { need_correction, reasoning } = schema.parse(response);
			if (!need_correction) stop_chain();
			const new_messages = utils.add_assistant_message(history, {
				text: `${reasoning}. Need Correction ${need_correction}`,
			});
			set_history(new_messages);
		},
	},
];
