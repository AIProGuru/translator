const puppeteer = require("puppeteer");

class PuppeteerService {
	async createPage() {
		this.browser = await puppeteer.launch({ headless: true });
		this.page = await this.browser.newPage();
		return this.page;
	}

	async setupPage(page, base64PDF) {
		await page.setContent(`
      <html>
        <body>
          <canvas></canvas>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.12.313/pdf.min.js"></script>
          <script>
            const pdfData = atob('${base64PDF}');
            const uint8Array = new Uint8Array(pdfData.length);
            for (let i = 0; i < pdfData.length; i++) {
              uint8Array[i] = pdfData.charCodeAt(i);
            }

            window.renderPage = async function(pageNum) {
              const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
              const pdf = await loadingTask.promise;
              const page = await pdf.getPage(pageNum);

              const scale = 2;
              const viewport = page.getViewport({ scale });
              const canvas = document.querySelector('canvas');
              const context = canvas.getContext('2d');

              canvas.width = viewport.width;
              canvas.height = viewport.height;

              await page.render({ canvasContext: context, viewport }).promise;
            };

            window.getPageCount = async function() {
              const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
              const pdf = await loadingTask.promise;
              return pdf.numPages;
            };
          </script>
        </body>
      </html>
    `);
	}

	async getPagesCount(page) {
		return await page.evaluate(() => window.getPageCount());
	}

	async cleanup() {
		if (this.browser) await this.browser.close();
	}
}

module.exports = PuppeteerService;
