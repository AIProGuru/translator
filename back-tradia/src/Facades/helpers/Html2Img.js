const puppeteer = require("puppeteer");
const fs = require("fs-extra");
const path = require("path");
class BrowserSingleton {
	constructor() {
		this.browser = null;
		this.initPromise = null;
	}
	async getBrowser() {
		if (!this.browser) {
			if (!this.initPromise) {
				this.initPromise = this.initializeBrowser();
			}
			await this.initPromise;
		}
		return this.browser;
	}
	async initializeBrowser() {
		try {
			this.browser = await puppeteer.launch({
				headless: "new",
				args: [
					"--no-sandbox",
					"--disable-setuid-sandbox",
					"--disable-dev-shm-usage", 
					"--disable-gpu", 
				],
			});
			this.browser.on("disconnected", () => {
				this.browser = null;
				this.initPromise = null;
			});
		} catch (error) {
			console.error("Error al convertir de html a iamgen:", error);
			this.browser = null;
			this.initPromise = null;
			throw error;
		}
	}
	async closeBrowser() {
		if (this.browser) {
			await this.browser.close().catch(console.error);
			this.browser = null;
			this.initPromise = null;
		}
	}
}
const browserInstance = new BrowserSingleton();
class HtmlToImageService {
	async convertToImage(htmlContent, outputPath, customDimensions = null) {
		let page = null;
		try {
			const browser = await browserInstance.getBrowser();
			page = await browser.newPage();
			const initialViewport = {
				width: customDimensions?.width || 1920,
				height: customDimensions?.height || 1080,
				deviceScaleFactor: 1,
			};
			await page.setViewport(initialViewport);
			await page.setRequestInterception(true);
			page.on("request", (req) => {
				const resourceType = req.resourceType();
				if (
					[
						"font",
						"image",
						"stylesheet",
						"script",
						"document",
					].includes(resourceType)
				) {
					req.continue();
				} else {
					req.abort();
				}
			});
			await page.setContent(htmlContent, {
				waitUntil: ["load", "networkidle0"],
				timeout: 30000,
			});
			let dimensions = customDimensions;
			if (!dimensions) {
				dimensions = await page.evaluate(() => ({
					width: Math.max(
						document.documentElement.scrollWidth,
						document.body.scrollWidth
					),
					height: Math.max(
						document.documentElement.scrollHeight,
						document.body.scrollHeight
					),
				}));
				await page.setViewport({
					width: dimensions.width,
					height: dimensions.height,
					deviceScaleFactor: 2,
				});
			}
			await fs.ensureDir(path.dirname(outputPath));
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
				image_path: outputPath,
				success: true,
			};
		} catch (error) {
			console.error("Error en la conversión:", error);
			throw error;
		} finally {
			if (page) {
				await page.close().catch(console.error);
			}
		}
	}
}
module.exports = new HtmlToImageService();
