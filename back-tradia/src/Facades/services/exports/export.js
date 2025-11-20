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
			// When running as root (common on some servers/containers), Chromium must be
			// started with no-sandbox flags or it will fail to launch.
			const browser = await puppeteer.launch({
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
				headless: "new",
			});
			const page = await browser.newPage();

			// Ensure the viewport matches the original page pixel dimensions.
			const { width, height } = this.config.dimensions || {};
			if (width && height) {
				await page.setViewport({
					width,
					height,
					deviceScaleFactor: 1,
				});
			}

			await page.setContent(this.config.html, { waitUntil: "networkidle0" });

			// Make the PDF page the same size as the original page (in CSS pixels).
			const pdfOptions = width && height
				? {
						path: file_path,
						printBackground: true,
						width: `${width}px`,
						height: `${height}px`,
				  }
				: {
						path: file_path,
						printBackground: true,
						format: "A4",
				  };

			await page.pdf(pdfOptions);
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
