const { z } = require("zod");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs-extra");
class Export {
	static CONSTRUCTOR_SCHEMA = z.object({
		html: z.string(),
		process: z.any(), // process instance sequealize
		process_dir: z.string(),
		dimensions: z.object({
			width: z.number(), // px
			height: z.number(), // px
		}),
	});
	constructor(input) {
		this.config = Export.CONSTRUCTOR_SCHEMA.parse(input);
	}
	async toPDF() {
		try {
			const FILE_NAME = "export_pdf.pdf";
			const file_path = path.join(this.config.process_dir, FILE_NAME);
			const browser = await puppeteer.launch();
			const page = await browser.newPage();
			await page.setContent(this.config.html);
			let options = {
				path: file_path,
				printBackground: true,
			};
			if (this.config.dimensions) {
				options = { ...options, ...this.config.dimensions };
			} else {
				options.format = "A4";
			}
			await page.pdf(options);
			browser.close();
			return file_path;
		} catch (error) {
			console.error(error);
		}
	}
	async toHTML() {
		const FILE_NAME = "export_html.html";
		const file_path = path.join(this.config.process_dir, FILE_NAME);
		await fs.writeFile(file_path, this.config.html);
		return file_path;
	}
}
module.exports = Export;
