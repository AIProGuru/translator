const fs = require("fs-extra");
const path = require("path");
const htmlToImageService = require("./html-to-image");
class ConverterHTMLtoImage {
	constructor() {}
	async converterHTMLtoImage(req) {
		try {
			console.log("Datos recibidos:", req.body);
			const inputDir = req.body.html;
			const outputDir = req.body.output;

			if (!inputDir || !outputDir) {
				throw new Error(
					"Debe especificar el directorio de entrada (html) y el directorio de salida (output)"
				);
			}
			const absoluteInputDir = path.resolve(inputDir);
			const absoluteOutputDir = path.resolve(outputDir);

			console.log("Directorio de entrada:", absoluteInputDir);
			console.log("Directorio de salida:", absoluteOutputDir);

			if (!(await fs.pathExists(absoluteInputDir))) {
				throw new Error(
					`El directorio de entrada no existe: ${absoluteInputDir}`
				);
			}

			await fs.ensureDir(absoluteOutputDir);

			const files = await fs.readdir(absoluteInputDir);
			const htmlFiles = files.filter((file) =>
				file.toLowerCase().endsWith(".html")
			);

			console.log(
				`Encontrados ${htmlFiles.length} archivos HTML para procesar`
			);

			if (htmlFiles.length === 0) {
				throw new Error(
					"No se encontraron archivos HTML en el directorio especificado"
				);
			}

			const results = [];

			for (const htmlFile of htmlFiles) {
				const htmlPath = path.join(absoluteInputDir, htmlFile);
				const timestamp = Date.now();

				try {
					const imageName = path.basename(htmlFile, ".html") + ".png";
					const imagePath = path.join(absoluteOutputDir, imageName);

					const result = await htmlToImageService.convertToImage(
						htmlPath,
						imagePath
					);

					results.push({
						sourceFile: htmlFile,
						outputImage: imageName,
						path: imagePath,
						timestamp: new Date(timestamp).toISOString(),
						...result,
					});

					console.log(
						`Archivo ${htmlFile} convertido exitosamente a ${imageName}`
					);
				} catch (error) {
					console.error(`Error procesando ${htmlFile}:`, error);
					results.push({
						sourceFile: htmlFile,
						error: error.message,
						timestamp: new Date(timestamp).toISOString(),
					});
				}
			}

			const successfulConversions = results.filter((r) => !r.error);
			const failedConversions = results.filter((r) => r.error);

			return {
				success: true,
				message: `Procesados ${htmlFiles.length} archivos HTML`,
				data: {
					totalFiles: htmlFiles.length,
					successfulConversions: successfulConversions.length,
					failedConversions: failedConversions.length,
					outputDirectory: absoluteOutputDir,
					timestamp: new Date().toISOString(),
					user: process.env.USER || "andycortex",
					results: results,
				},
			};
		} catch (error) {
			console.error("Error:", error);
		}
	}
}
module.exports = ConverterHTMLtoImage;
