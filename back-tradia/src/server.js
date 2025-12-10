const express = require("express");
const app = express();
const cors = require("cors");
const passport = require("passport");
require("./Api/shared/config/passport.config");
const documentProcessing = require("./Api/routes/document_processing.routes");
const processRoutes = require("./Api/routes/process.routes");
const promptTemplateRoutes = require("./Api/routes/prompt_templates.routes");
const userRoutes = require("./Api/routes/user.routes");
const requireAuth = require("./Facades/middleware/requireAuth");
const authenticate = require("./Api/routes/auth.routes");
const constants = require("./Api/shared/config/constants");
const cookieParser = require("cookie-parser");
const processWatcher = require('./Facades/services/processWhatcher/processWatcher');
const userService = require("./Facades/services/users");

const DatabaseConnection = require("./Api/infrastructure/database/connections/sequelize.connection");
const refreshToken = require("./Facades/middleware/refreshToken");

app.set("trust proxy", 1);
app.use(
    cors({
        origin: constants.FRONT_HOST,
        credentials: true,
    }),
);
app.use(cookieParser());
app.use(refreshToken);
app.use(passport.initialize());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/api", documentProcessing);
app.use("/api", processRoutes);
app.use("/api", promptTemplateRoutes);
app.use("/api", userRoutes);
app.use("/api/auth", authenticate);

app.get("/protected", requireAuth, (req, res) => {
    res.json({ message: "Ruta protegida", user: req.user });
});

const initializeDatabase = async () => {
    const db = DatabaseConnection.getInstance();
    await db.authenticate();
    await db.syncModels();
    await userService.ensureAdminAccount();
};

app.use((req, res) => {
    res.status(404).json({
        error: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
    });
});

const startServer = async () => {
    try {
        await initializeDatabase();
        const server = app.listen(constants.PORT, () => {
            console.log(`Servidor corriendo en el puerto ${constants.PORT}`);
            console.log(`Directorio base para outputs: ${constants.BASE_PATH}`);
            processWatcher.start();
        });

        process.on('SIGTERM', () => {
            console.log('Recibida señal SIGTERM. Cerrando servidor...');
            server.close(() => {
                console.log('Servidor cerrado.');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('Recibida señal SIGINT. Cerrando servidor...');
            server.close(() => {
                console.log('Servidor cerrado.');
                process.exit(0);
            });
        });


    } catch (error) {
        console.error("Error al iniciar el servidor:", error);
        process.exit(1);
    }
};



startServer();
