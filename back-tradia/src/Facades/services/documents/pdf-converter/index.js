const path = require("path");
const fs = require("fs-extra");
const sharp = require("sharp");
const { spawn, exec } = require("child_process");

class PDFService {
	constructor() {}

	async sanitizePDF(inputPath, outputDir) {
		return new Promise((resolve, reject) => {
			if (!fs.existsSync(outputDir)) {
				fs.mkdirSync(outputDir, { recursive: true });
			}

			const originalName = path.basename(inputPath);
			const sanitizedPath = path.join(
				outputDir,
				`${Date.now()}-sanitized-${originalName}`
			);
			exec("which gs", (err, stdout) => {
				if (err || !stdout) {
					console.warn(
						"[Aviso] Ghostscript no está instalado. Saltando sanitización."
					);
					return resolve(inputPath);
				}

				const command = `gs -o "${sanitizedPath}" -sDEVICE=pdfwrite -dPDFSETTINGS=/prepress "${inputPath}"`;
				exec(command, (error, stdout, stderr) => {
					if (error) {
						console.error("[Ghostscript Error]", stderr);
						return reject(
							new Error(
								"Error al sanitizar el PDF con Ghostscript."
							)
						);
					}
					resolve(sanitizedPath);
				});
			});
		});
	}

	async convertPDFToImages(pdfPath, outputDirectory) {
		const absoluteOutputDir = path.resolve(outputDirectory);
		await fs.ensureDir(absoluteOutputDir);
		let pageCount = 0;
		try {

			const safePDF = await this.sanitizePDF(pdfPath, absoluteOutputDir);

			const outputBase = path.join(absoluteOutputDir, "page");

			const pdftoppm = spawn("pdftoppm", ["-png", safePDF, outputBase]);

			pdftoppm.stdout.on("data", (data) => {
				console.log(`stdout: ${data}`);
			});

			pdftoppm.stderr.on("data", (data) => {
				console.error(`stderr: ${data}`);
			});

			return new Promise((resolve, reject) => {
				pdftoppm.on("close", async (code) => {
					if (code === 0) {
						console.log("PDF conversion completed successfully.");

						const imageInfo = [];
						

						while (
							fs.existsSync(`${outputBase}-${pageCount + 1}.png`)
						) {
							const imagePath = `${outputBase}-${
								pageCount + 1
							}.png`;

							const metadata = await sharp(imagePath).metadata();
							imageInfo.push({
								name: `page-${pageCount + 1}.png`,
								path: imagePath,
								dimensions: {
									width: metadata.width,
									height: metadata.height,
								},
							});

							pageCount++;
						}

						resolve({
							pagesCount: pageCount,
							outputDirectory: absoluteOutputDir,
							images: imageInfo,
						});
					} else {
						console.error(
							`pdftoppm process exited with code ${code}`
						);
						reject(
							new Error("Error al convertir el PDF a imágenes.")
						);
					}
				});
			});
		} catch (error) {
			console.error("Error convirtiendo PDF a imágenes:", error);
				throw new Error(
					"The PDF to image conversion failed. The file may be corrupted. The page limit is reported to be 10 pages."
				);
		}
	}
}

module.exports = PDFService;
