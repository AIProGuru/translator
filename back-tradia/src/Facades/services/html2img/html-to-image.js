const puppeteer = require("puppeteer");
const fs = require("fs-extra");

class HtmlToImageService {
	async convertToImage(htmlPath, outputPath) {
		let browser = null;
		try {
			browser = await puppeteer.launch({
				headless: "new",
				args: ["--no-sandbox", "--disable-setuid-sandbox"],
			});

			const page = await browser.newPage();

			await page.setViewport({
				width: 1920,
				height: 1080,
				deviceScaleFactor: 2,
			});

			const htmlContent = await fs.readFile(htmlPath, "utf-8");

			await page.setContent(htmlContent, {
				waitUntil: ["load", "networkidle0"],
				timeout: 30000,
			});

			await page.evaluate(() => {
				return new Promise((resolve) => {
					if (document.readyState === "complete") {
						resolve();
					} else {
						window.addEventListener("load", resolve);
					}
				});
			});

			const dimensions = await page.evaluate(() => {
				return {
					width: Math.max(
						document.documentElement.scrollWidth,
						document.body.scrollWidth
					),
					height: Math.max(
						document.documentElement.scrollHeight,
						document.body.scrollHeight
					),
				};
			});

			await page.setViewport({
				width: dimensions.width,
				height: dimensions.height,
				deviceScaleFactor: 2,
			});

			await page.screenshot({
				path: outputPath,
				fullPage: true,
				type: "png",
				omitBackground: false,
			});

			const stats = await fs.stat(outputPath);

			return {
				dimensions,
				size: {
					bytes: stats.size,
					megabytes: (stats.size / (1024 * 1024)).toFixed(2),
				},
				success: true,
			};
		} catch (error) {
			console.error("Error en la conversión:", error);
			throw error;
		} finally {
			if (browser) {
				await browser.close().catch(console.error);
			}
		}
	}
}

module.exports = new HtmlToImageService();
