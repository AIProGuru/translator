const { z } = require("zod");
const path = require("path");
const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const cheerio = require("cheerio");
const { PDFDocument } = require("pdf-lib");
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

			const pagesInfo = this._getPagesInfo();
			const hasMixedPageSizes = this._hasMixedPageSizes(pagesInfo);
			if (hasMixedPageSizes) {
				const multiPath = await this._toPDFMultiPage(
					file_path,
					pagesInfo,
				);
				if (multiPath) {
					return multiPath;
				}
			}

			return await this._toPDFSingle(file_path);
		} catch (error) {
			console.error(error);
		}
	}

	async _toPDFSingle(file_path) {
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

		// Make the PDF page match the pixel dimensions we used when generating
		// the HTML pages. This avoids any cropping of right/left content and
		// keeps coordinates consistent with the preview/patch editor.
		const pdfOptions =
			width && height
				? {
						path: file_path,
						printBackground: true,
						width: `${width}px`,
						height: `${height}px`,
						preferCSSPageSize: true,
						margin: {
							top: 0,
							right: 0,
							bottom: 0,
							left: 0,
						},
				  }
				: {
						path: file_path,
						printBackground: true,
						format: "A4",
						margin: {
							top: 0,
							right: 0,
							bottom: 0,
							left: 0,
						},
				  };

		await page.pdf(pdfOptions);
		await browser.close();
		return file_path;
	}

	_getPagesInfo() {
		const process = this.config.process;
		const pagesInfo =
			this.config.pages_info ||
			process?.pages_info ||
			process?.dataValues?.pages_info;
		return Array.isArray(pagesInfo) ? pagesInfo : [];
	}

	_hasMixedPageSizes(pagesInfo) {
		if (!Array.isArray(pagesInfo) || pagesInfo.length <= 1) {
			return false;
		}
		const sizes = new Set(
			pagesInfo
				.map((page) => page?.dimensions)
				.filter(Boolean)
				.map((dim) => `${dim.width}x${dim.height}`),
		);
		return sizes.size > 1;
	}

	_extractPagesFromHtml(html) {
		const $ = cheerio.load(html);
		const headStyle = $("head style").html() || "";
		const pageNodes = $("page").toArray();
		const pages = pageNodes.map((node, index) => {
			const id = $(node).attr("id") || "";
			const match = id.match(/page-(\d+)/i);
			const pageNumber = match ? parseInt(match[1], 10) : index + 1;
			return {
				pageNumber,
				pageHtml: $.html(node),
			};
		});
		return { headStyle, pages };
	}

	_buildSinglePageHtml(headStyle, pageHtml) {
		return `<!doctype html>
<html lang="en">
	<head>
		<meta charset="UTF-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1.0" />
		<style>
			html, body { margin: 0; padding: 0; }
			@page { margin: 0; }
			page { page-break-before: avoid !important; page-break-after: avoid !important; }
			${headStyle || ""}
		</style>
	</head>
	<body>
		${pageHtml || ""}
	</body>
</html>`;
	}

	async _toPDFMultiPage(file_path, pagesInfo) {
		const { headStyle, pages } = this._extractPagesFromHtml(
			this.config.html,
		);
		if (!pages.length) {
			return null;
		}

		const pageInfoByNumber = new Map(
			pagesInfo.map((info) => [info.pageNumber || info.page_number, info]),
		);

		const browser = await puppeteer.launch({
			args: ["--no-sandbox", "--disable-setuid-sandbox"],
			headless: "new",
		});

		const mergedPdf = await PDFDocument.create();

		for (let index = 0; index < pages.length; index += 1) {
			const { pageHtml, pageNumber } = pages[index];
			const info =
				pageInfoByNumber.get(pageNumber) || pagesInfo[index];
			const dimensions = info?.dimensions || this.config.dimensions;
			if (!dimensions?.width || !dimensions?.height) {
				continue;
			}

			const page = await browser.newPage();
			await page.setViewport({
				width: dimensions.width,
				height: dimensions.height,
				deviceScaleFactor: 1,
			});

			const html = this._buildSinglePageHtml(headStyle, pageHtml);
			await page.setContent(html, { waitUntil: "networkidle0" });

			const pdfBuffer = await page.pdf({
				printBackground: true,
				width: `${dimensions.width}px`,
				height: `${dimensions.height}px`,
				preferCSSPageSize: true,
				margin: {
					top: 0,
					right: 0,
					bottom: 0,
					left: 0,
				},
			});
			await page.close();

			const srcDoc = await PDFDocument.load(pdfBuffer);
			const copiedPages = await mergedPdf.copyPages(
				srcDoc,
				srcDoc.getPageIndices(),
			);
			copiedPages.forEach((copiedPage) =>
				mergedPdf.addPage(copiedPage),
			);
		}

		await browser.close();

		const mergedBytes = await mergedPdf.save();
		await fs.writeFile(file_path, mergedBytes);

		return file_path;
	}
	async toHTML() {
		const FILE_NAME = "export_html.html";
		const file_path = path.join(this.config.process_dir, FILE_NAME);
		await fs.writeFile(file_path, this.config.html);
		return file_path;
	}
}
module.exports = Export;
